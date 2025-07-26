import nlp from 'compromise';

export interface ColumnInsights {
  hasDate: boolean;
  hasMoney: boolean;
  hasPerson: boolean;
  hasPlace: boolean;
  hasProduct: boolean;
  hasAction: boolean;
  hasStatus: boolean;
  hasQuantity: boolean;
  hasEmail: boolean;
  hasId: boolean;
}

export interface ColumnPurpose {
  primary: string;
  confidence: number;
  suggestions: string[];
}

export interface ColumnAnalysis {
  name: string;
  insights: ColumnInsights;
  purpose: ColumnPurpose;
  terms: string[];
  normalized: string;
}

/**
 * Analyzes column name semantics using NLP
 */
export const analyzeColumnSemantics = (columnName: string): ColumnAnalysis => {
  // Normalize column name for analysis
  const normalized = columnName
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .trim();
  
  const doc = nlp(normalized);
  
  // Extract insights about the column
  const insights: ColumnInsights = {
    hasDate: doc.has('#Date') || doc.match('(date|time|year|month|day|created|updated|modified)').found,
    hasMoney: doc.has('#Money') || doc.match('(price|cost|revenue|amount|salary|fee|payment|total|subtotal|tax|discount)').found,
    hasPerson: doc.has('#Person') || doc.match('(customer|client|user|employee|name|contact|owner|manager)').found,
    hasPlace: doc.has('#Place') || doc.match('(city|country|state|location|address|region|area|zip|postal)').found,
    hasProduct: doc.match('(product|item|sku|service|good|article|material)').found,
    hasAction: doc.has('#Verb') || doc.match('(created|updated|deleted|processed|sent|received|approved)').found,
    hasStatus: doc.match('(status|state|active|pending|completed|cancelled|draft|published)').found,
    hasQuantity: doc.match('(count|quantity|amount|number|total|sum|units|items)').found,
    hasEmail: doc.match('(email|mail)').found,
    hasId: doc.match('(id|key|code|number|ref|reference)').found && columnName.toLowerCase().endsWith('id'),
  };
  
  // Get terms for further analysis
  const terms = doc.terms().out('array');
  
  // Determine primary purpose
  const purpose = classifyColumnPurpose(insights, terms, normalized);
  
  return {
    name: columnName,
    insights,
    purpose,
    terms,
    normalized,
  };
};

/**
 * Classifies the primary purpose of a column based on insights
 */
const classifyColumnPurpose = (
  insights: ColumnInsights, 
  terms: string[], 
  normalized: string
): ColumnPurpose => {
  const purposes: Array<{ type: string; confidence: number; suggestions: string[] }> = [];
  
  // Financial columns
  if (insights.hasMoney || terms.some(t => ['price', 'cost', 'revenue', 'amount'].includes(t))) {
    purposes.push({
      type: 'financial',
      confidence: insights.hasMoney ? 0.9 : 0.7,
      suggestions: ['Calculate totals', 'Show trends over time', 'Find top values'],
    });
  }
  
  // Temporal columns
  if (insights.hasDate) {
    purposes.push({
      type: 'temporal',
      confidence: 0.9,
      suggestions: ['Show timeline', 'Group by period', 'Find recent changes'],
    });
  }
  
  // Entity identifiers
  if (insights.hasPerson) {
    purposes.push({
      type: 'customer',
      confidence: normalized.includes('customer') ? 0.95 : 0.8,
      suggestions: ['Count unique', 'Find top customers', 'Group activities'],
    });
  }
  
  if (insights.hasProduct) {
    purposes.push({
      type: 'product',
      confidence: 0.85,
      suggestions: ['Product performance', 'Inventory analysis', 'Popular items'],
    });
  }
  
  // Geographic data
  if (insights.hasPlace) {
    purposes.push({
      type: 'geographic',
      confidence: 0.85,
      suggestions: ['Map visualization', 'Regional analysis', 'Location grouping'],
    });
  }
  
  // Status/Category
  if (insights.hasStatus) {
    purposes.push({
      type: 'categorical',
      confidence: 0.8,
      suggestions: ['Status distribution', 'Filter by status', 'Track changes'],
    });
  }
  
  // Quantity/Metrics
  if (insights.hasQuantity && !insights.hasMoney) {
    purposes.push({
      type: 'metric',
      confidence: 0.75,
      suggestions: ['Sum totals', 'Average values', 'Find outliers'],
    });
  }
  
  // Identifiers
  if (insights.hasId) {
    purposes.push({
      type: 'identifier',
      confidence: 0.9,
      suggestions: ['Count unique', 'Find duplicates', 'Use as key'],
    });
  }
  
  // Email
  if (insights.hasEmail) {
    purposes.push({
      type: 'contact',
      confidence: 0.95,
      suggestions: ['Validate emails', 'Count unique', 'Domain analysis'],
    });
  }
  
  // Sort by confidence and return the best match
  purposes.sort((a, b) => b.confidence - a.confidence);
  
  if (purposes.length > 0) {
    return {
      primary: purposes[0].type,
      confidence: purposes[0].confidence,
      suggestions: purposes[0].suggestions,
    };
  }
  
  // Default fallback
  return {
    primary: 'general',
    confidence: 0.5,
    suggestions: ['Explore values', 'Count occurrences', 'Find patterns'],
  };
};

/**
 * Analyzes multiple columns to find relationships
 */
export const analyzeColumnRelationships = (columns: ColumnAnalysis[]) => {
  const relationships = [];
  
  // Find date-money relationships (good for time series)
  const dateColumns = columns.filter(c => c.insights.hasDate);
  const moneyColumns = columns.filter(c => c.insights.hasMoney);
  
  if (dateColumns.length > 0 && moneyColumns.length > 0) {
    relationships.push({
      type: 'timeseries',
      columns: [dateColumns[0].name, moneyColumns[0].name],
      confidence: 0.9,
      suggestion: 'Financial trends over time',
    });
  }
  
  // Find entity-money relationships (good for rankings)
  const entityColumns = columns.filter(c => 
    c.insights.hasPerson || c.insights.hasProduct || c.purpose.primary === 'categorical'
  );
  
  if (entityColumns.length > 0 && moneyColumns.length > 0) {
    relationships.push({
      type: 'ranking',
      columns: [entityColumns[0].name, moneyColumns[0].name],
      confidence: 0.85,
      suggestion: `Top ${entityColumns[0].name} by revenue`,
    });
  }
  
  // Find geographic relationships
  const geoColumns = columns.filter(c => c.insights.hasPlace);
  if (geoColumns.length > 0) {
    relationships.push({
      type: 'geographic',
      columns: geoColumns.map(c => c.name),
      confidence: 0.8,
      suggestion: 'Geographic distribution',
    });
  }
  
  return relationships;
};