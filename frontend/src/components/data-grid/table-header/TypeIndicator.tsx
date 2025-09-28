import React from 'react';
import { Hash, Calendar, ToggleLeft, Type, Binary, List } from 'lucide-react';

interface TypeIndicatorProps {
  type: string;
  size?: number;
  className?: string;
}

const TypeIndicator: React.FC<TypeIndicatorProps> = ({ 
  type, 
  size = 12,
  className = ''
}) => {
  const normalizedType = (typeof type === 'string' ? type : String(type || '')).toLowerCase();
  
  // Determine icon and color based on type
  const getTypeIcon = () => {
    if (normalizedType.includes('int') || normalizedType.includes('double') || 
        normalizedType.includes('float') || normalizedType.includes('decimal') ||
        normalizedType.includes('numeric') || normalizedType === 'number') {
      return <Hash size={size} className="text-tertiary" />;
    }
    if (normalizedType.includes('date') || normalizedType.includes('time') || normalizedType === 'date') {
      return <Calendar size={size} className="text-secondary opacity-85" />;
    }
    if (normalizedType.includes('bool') || normalizedType === 'boolean') {
      return <ToggleLeft size={size} className="text-primary" />;
    }
    if (normalizedType.includes('array') || normalizedType.includes('list') || normalizedType === 'array') {
      return <List size={size} className="text-muted-foreground" />;
    }
    if (normalizedType.includes('blob') || normalizedType.includes('binary') || normalizedType === 'object') {
      return <Binary size={size} className="text-muted-foreground" />;
    }
    // Default for varchar, text, etc.
    return <Type size={size} className="text-muted-foreground" />;
  };

  return (
    <div className={`inline-flex items-center justify-center ${className}`} title={type}>
      {getTypeIcon()}
    </div>
  );
};

export default TypeIndicator;