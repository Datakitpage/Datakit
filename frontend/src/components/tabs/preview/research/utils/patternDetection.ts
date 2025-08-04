import { format, parse, isValid } from 'date-fns';

export interface DataPattern {
  isNumeric: boolean;
  isCurrency: boolean;
  isPercentage: boolean;
  isInteger: boolean;
  isFloat: boolean;
  isDate: boolean;
  dateFormat?: string;
  isEmail: boolean;
  isURL: boolean;
  isPhone: boolean;
  isBoolean: boolean;
  isCategory: boolean;
  uniqueCount: number;
  uniqueRatio: number;
  nullCount: number;
  nullRatio: number;
  distribution?: NumericDistribution;
  topValues?: Array<{ value: string; count: number; percentage: number }>;
  sampleValues: string[];
}

export interface NumericDistribution {
  min: number;
  max: number;
  mean: number;
  median: number;
  mode: number;
  stdDev: number;
  q1: number;
  q3: number;
  outliers: number[];
}

/**
 * Common date formats to test
 */
const DATE_FORMATS = [
  'yyyy-MM-dd',
  'MM/dd/yyyy',
  'dd/MM/yyyy',
  'yyyy/MM/dd',
  'MM-dd-yyyy',
  'dd-MM-yyyy',
  'yyyy-MM-dd HH:mm:ss',
  'MM/dd/yyyy HH:mm:ss',
  'dd/MM/yyyy HH:mm:ss',
  'yyyy-MM-dd\'T\'HH:mm:ss',
  'yyyy-MM-dd\'T\'HH:mm:ss\'Z\'',
];

/**
 * Detects patterns in a column's data
 */
export const detectDataPatterns = async (
  values: any[],
  sampleSize: number = 1000
): Promise<DataPattern> => {
  // Sample values if dataset is large
  const sample = values.length > sampleSize 
    ? values.slice(0, sampleSize) 
    : values;
  
  // Filter out null/undefined values for analysis
  const nonNullValues = sample.filter(v => v !== null && v !== undefined && v !== '');
  const stringValues = nonNullValues.map(v => String(v));
  
  // Basic counts
  const uniqueValues = new Set(nonNullValues);
  const uniqueCount = uniqueValues.size;
  const uniqueRatio = nonNullValues.length > 0 ? uniqueCount / nonNullValues.length : 0;
  const nullCount = sample.length - nonNullValues.length;
  const nullRatio = sample.length > 0 ? nullCount / sample.length : 0;
  
  // Type detection
  const patterns: DataPattern = {
    isNumeric: checkIfNumeric(nonNullValues),
    isCurrency: checkIfCurrency(stringValues),
    isPercentage: checkIfPercentage(stringValues),
    isInteger: checkIfInteger(nonNullValues),
    isFloat: checkIfFloat(nonNullValues),
    isDate: false,
    isEmail: checkIfEmail(stringValues),
    isURL: checkIfURL(stringValues),
    isPhone: checkIfPhone(stringValues),
    isBoolean: checkIfBoolean(nonNullValues),
    isCategory: uniqueRatio < 0.1 && uniqueCount < 50, // Less than 10% unique and < 50 categories
    uniqueCount,
    uniqueRatio,
    nullCount,
    nullRatio,
    sampleValues: stringValues.slice(0, 5),
  };
  
  // Date detection with format
  const dateCheck = checkIfDate(stringValues);
  patterns.isDate = dateCheck.isDate;
  patterns.dateFormat = dateCheck.format;
  
  // Numeric distribution
  if (patterns.isNumeric) {
    patterns.distribution = calculateDistribution(nonNullValues.map(Number));
  }
  
  // Top values for categories
  if (patterns.isCategory || uniqueCount <= 20) {
    patterns.topValues = calculateTopValues(nonNullValues);
  }
  
  return patterns;
};

/**
 * Check if values are numeric
 */
const checkIfNumeric = (values: any[]): boolean => {
  return values.length > 0 && values.every(v => {
    const num = Number(v);
    return !isNaN(num) && isFinite(num);
  });
};

/**
 * Check if values are currency
 */
const checkIfCurrency = (values: string[]): boolean => {
  const currencyRegex = /^[$€£¥]?\s*-?\d{1,3}(,\d{3})*(\.\d{1,2})?$|^-?\d{1,3}(,\d{3})*(\.\d{1,2})?\s*[$€£¥]?$/;
  return values.length > 0 && values.every(v => currencyRegex.test(v.trim()));
};

/**
 * Check if values are percentages
 */
const checkIfPercentage = (values: string[]): boolean => {
  const percentRegex = /^-?\d+\.?\d*\s*%?$/;
  return values.length > 0 && 
    values.every(v => percentRegex.test(v.trim())) &&
    values.some(v => v.includes('%') || (Number(v) >= 0 && Number(v) <= 100));
};

/**
 * Check if values are integers
 */
const checkIfInteger = (values: any[]): boolean => {
  return values.length > 0 && values.every(v => {
    const num = Number(v);
    return !isNaN(num) && Number.isInteger(num);
  });
};

/**
 * Check if values are floats
 */
const checkIfFloat = (values: any[]): boolean => {
  return values.length > 0 && 
    checkIfNumeric(values) && 
    values.some(v => {
      const num = Number(v);
      return !Number.isInteger(num);
    });
};

/**
 * Check if values are dates and detect format
 */
const checkIfDate = (values: string[]): { isDate: boolean; format?: string } => {
  if (values.length === 0) return { isDate: false };
  
  // Try each date format
  for (const dateFormat of DATE_FORMATS) {
    const isValidFormat = values.every(v => {
      try {
        const parsed = parse(v, dateFormat, new Date());
        return isValid(parsed);
      } catch {
        return false;
      }
    });
    
    if (isValidFormat) {
      return { isDate: true, format: dateFormat };
    }
  }
  
  // Try native Date parsing as fallback
  const isNativeDate = values.every(v => {
    const date = new Date(v);
    return !isNaN(date.getTime());
  });
  
  return { isDate: isNativeDate, format: isNativeDate ? 'native' : undefined };
};

/**
 * Check if values are email addresses
 */
const checkIfEmail = (values: string[]): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return values.length > 0 && 
    values.filter(v => emailRegex.test(v.trim())).length / values.length > 0.8;
};

/**
 * Check if values are URLs
 */
const checkIfURL = (values: string[]): boolean => {
  const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
  return values.length > 0 && 
    values.filter(v => urlRegex.test(v.trim())).length / values.length > 0.8;
};

/**
 * Check if values are phone numbers
 */
const checkIfPhone = (values: string[]): boolean => {
  const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{4,6}$/;
  return values.length > 0 && 
    values.filter(v => phoneRegex.test(v.replace(/\s/g, ''))).length / values.length > 0.8;
};

/**
 * Check if values are boolean
 */
const checkIfBoolean = (values: any[]): boolean => {
  const booleanValues = new Set(['true', 'false', '1', '0', 'yes', 'no', 'y', 'n', true, false, 1, 0]);
  return values.length > 0 && values.every(v => 
    booleanValues.has(typeof v === 'string' ? v.toLowerCase() : v)
  );
};

/**
 * Calculate numeric distribution statistics
 */
const calculateDistribution = (numbers: number[]): NumericDistribution => {
  const sorted = [...numbers].sort((a, b) => a - b);
  const n = sorted.length;
  
  // Basic stats
  const min = sorted[0];
  const max = sorted[n - 1];
  const mean = numbers.reduce((a, b) => a + b, 0) / n;
  
  // Median
  const median = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)];
  
  // Mode (most frequent value)
  const frequency = new Map<number, number>();
  numbers.forEach(num => {
    frequency.set(num, (frequency.get(num) || 0) + 1);
  });
  const mode = [...frequency.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 0;
  
  // Quartiles
  const q1 = sorted[Math.floor(n * 0.25)];
  const q3 = sorted[Math.floor(n * 0.75)];
  
  // Standard deviation
  const variance = numbers.reduce((sum, num) => sum + Math.pow(num - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);
  
  // Outliers (using IQR method)
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  const outliers = numbers.filter(n => n < lowerBound || n > upperBound);
  
  return {
    min,
    max,
    mean,
    median,
    mode,
    stdDev,
    q1,
    q3,
    outliers,
  };
};

/**
 * Calculate top values and their frequencies
 */
const calculateTopValues = (values: any[]): Array<{ value: string; count: number; percentage: number }> => {
  const frequency = new Map<string, number>();
  
  values.forEach(val => {
    const key = String(val);
    frequency.set(key, (frequency.get(key) || 0) + 1);
  });
  
  const total = values.length;
  const topValues = [...frequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([value, count]) => ({
      value,
      count,
      percentage: (count / total) * 100,
    }));
  
  return topValues;
};