import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

@Injectable()
export class R2CloudStorageService {
  private readonly logger = new Logger(R2CloudStorageService.name);
  private s3Client: S3Client;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    const accountId = this.configService.get<string>('R2_CLOUD_ACCOUNT_ID');
    const accessKeyId = this.configService.get<string>('R2_CLOUD_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('R2_CLOUD_SECRET_ACCESS_KEY');
    this.bucketName = this.configService.get<string>('R2_CLOUD_BUCKET_NAME', 'datakit-cloud-storage');

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  /**
   * Upload file to R2 with optional compression
   */
  async uploadFile(
    buffer: Buffer,
    key: string,
    mimeType: string,
  ): Promise<{ key: string; compressed: boolean; compressedSize?: number }> {
    let uploadBuffer = buffer;
    let compressed = false;
    let compressedSize: number | undefined;

    // Compress text-based files
    const compressibleTypes = ['text/csv', 'application/json', 'text/plain', 'text/tab-separated-values'];
    if (compressibleTypes.includes(mimeType)) {
      try {
        const compressedBuffer = await gzip(buffer);
        // Only use compression if it reduces size by at least 10%
        if (compressedBuffer.length < buffer.length * 0.9) {
          uploadBuffer = compressedBuffer;
          compressed = true;
          compressedSize = compressedBuffer.length;
          key = `${key}.gz`;
          this.logger.log(
            `Compression completed: ${buffer.length} → ${compressedBuffer.length} bytes (${(
              ((buffer.length - compressedBuffer.length) / buffer.length) *
              100
            ).toFixed(2)}% reduction)`,
          );
        }
      } catch (error) {
        this.logger.error('Compression failed, uploading uncompressed:', error);
      }
    }

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: uploadBuffer,
      ContentType: compressed ? 'application/gzip' : mimeType,
      Metadata: {
        originalMimeType: mimeType,
        compressed: compressed.toString(),
        originalSize: buffer.length.toString(),
      },
    });

    await this.s3Client.send(command);
    this.logger.log(`File uploaded successfully to R2: ${key}`);

    return {
      key,
      compressed,
      compressedSize,
    };
  }

  /**
   * Get presigned URL for file download
   */
  async getPresignedUrl(key: string, expiresIn: number = 300): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const url = await getSignedUrl(this.s3Client, command, { expiresIn });
    return url;
  }

  /**
   * Delete file from R2
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      this.logger.log(`File deleted from R2: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete file from R2: ${key}`, error);
      throw error;
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Download and decompress file if needed
   */
  async downloadFile(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const response = await this.s3Client.send(command);
    const buffer = await this.streamToBuffer(response.Body);

    // Check if file is compressed
    if (key.endsWith('.gz') || response.Metadata?.compressed === 'true') {
      try {
        const decompressed = await gunzip(buffer);
        this.logger.log(`File decompressed: ${key}`);
        return decompressed;
      } catch (error) {
        this.logger.error('Decompression failed:', error);
        return buffer;
      }
    }

    return buffer;
  }

  /**
   * Convert stream to buffer
   */
  private async streamToBuffer(stream: any): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}