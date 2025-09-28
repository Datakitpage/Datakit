import React, { useState } from 'react';
import {
  FileText,
  Search,
  Play,
  Copy,
  Tag,
  Code2,
  BarChart3,
  Brain,
  Calculator,
  Settings,
  ChevronRight,
  Package,
} from 'lucide-react';

import { usePythonStore } from '@/store/pythonStore';
import { Button } from '@/components/ui/Button';
import { SCRIPT_TEMPLATES, searchTemplates } from '@/lib/python/templates';
import type { ScriptTemplate } from '@/lib/python/types';

// Category icons and labels
const CATEGORY_CONFIG = {
  data_analysis: {
    icon: BarChart3,
    label: 'Data Analysis',
    color: 'text-blue-400',
  },
  visualization: {
    icon: BarChart3,
    label: 'Visualization',
    color: 'text-green-400',
  },
  ml: { icon: Brain, label: 'Machine Learning', color: 'text-purple-400' },
  hf: { icon: null, label: 'Hugging Face', color: 'text-orange-400' },
  stats: { icon: Calculator, label: 'Statistics', color: 'text-orange-400' },
  utils: { icon: Settings, label: 'Utilities', color: 'text-gray-400' },
} as const;

/**
 * Script templates component for selecting and inserting code templates
 */
const ScriptTemplates: React.FC = () => {
  const { createCell, setActiveCellId } = usePythonStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);

  // Get filtered templates
  const getFilteredTemplates = () => {
    let templates = SCRIPT_TEMPLATES;

    // Apply search filter
    if (searchQuery.trim()) {
      templates = searchTemplates(searchQuery);
    }

    // Apply category filter
    if (selectedCategory) {
      templates = templates.filter(
        (template) => template.category === selectedCategory
      );
    }

    return templates;
  };

  const filteredTemplates = getFilteredTemplates();

  // Group templates by category
  const templatesByCategory = Object.keys(CATEGORY_CONFIG).reduce(
    (acc, category) => {
      const categoryTemplates = filteredTemplates.filter(
        (t) => t.category === category
      );
      if (categoryTemplates.length > 0) {
        acc[category as keyof typeof CATEGORY_CONFIG] = categoryTemplates;
      }
      return acc;
    },
    {} as Record<keyof typeof CATEGORY_CONFIG, ScriptTemplate[]>
  );

  const handleUseTemplate = (template: ScriptTemplate) => {
    // First, create a markdown cell with explanation
    const markdownContent = `# ${template.name}

${template.description}

${
  template.requiredPackages
    ? `**Required packages:** ${template.requiredPackages.join(', ')}\n`
    : ''
}

Run the code cell below to execute this template.`;

    createCell('markdown', markdownContent);

    // Then create the code cell with the template code
    const codeCellId = createCell('code', template.code);

    // Set the code cell as active
    setActiveCellId(codeCellId);
  };

  const handleCopyTemplate = async (template: ScriptTemplate) => {
    try {
      await navigator.clipboard.writeText(template.code);
      // You could add a toast notification here
    } catch (error) {
      console.error('Failed to copy template:', error);
    }
  };

  const categories = Object.keys(CATEGORY_CONFIG) as Array<
    keyof typeof CATEGORY_CONFIG
  >;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-5 h-5 text-primary" />
          <h3 className="font-medium text-foreground">Templates</h3>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search templates..."
            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap gap-1">
          <button
            className={`text-xs px-2 py-1 rounded transition-colors ${
              selectedCategory === null
                ? 'bg-primary/20 text-primary'
                : 'bg-accent/10 text-muted-foreground hover:bg-accent/20'
            }`}
            onClick={() => setSelectedCategory(null)}
          >
            All
          </button>
          {categories.map((category) => {
            const config = CATEGORY_CONFIG[category];
            return (
              <button
                key={category}
                className={`text-xs px-2 py-1 rounded transition-colors flex items-center gap-1 ${
                  selectedCategory === category
                    ? 'bg-primary/20 text-primary'
                    : 'bg-accent/10 text-muted-foreground hover:bg-accent/20'
                }`}
                onClick={() =>
                  setSelectedCategory(
                    selectedCategory === category ? null : category
                  )
                }
              >
                {config.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Templates list */}
      <div className="flex-1 overflow-y-auto">
        {filteredTemplates.length === 0 ? (
          <div className="p-4 text-center">
            <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {searchQuery ? 'No templates found' : 'No templates available'}
            </p>
          </div>
        ) : (
          <div className="space-y-4 p-2">
            {Object.entries(templatesByCategory).map(
              ([category, templates]) => {
                const config =
                  CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG];
                const Icon = config?.icon;

                return (
                  <div key={category} className="space-y-2">
                    {/* Category header (only show if not filtering by category) */}
                    {selectedCategory === null && (
                      <div className="flex items-center gap-2 px-2 py-1">
                        {Icon && <Icon className={`w-4 h-4 ${config.color}`} /> }
                        <h4 className="font-medium text-foreground text-sm">
                          {config.label}
                        </h4>
                        <div className="flex-1 h-px bg-accent/10" />
                        <span className="text-xs text-muted-foreground">
                          {templates.length}
                        </span>
                      </div>
                    )}

                    {/* Templates in this category */}
                    {templates.map((template) => (
                      <div
                        key={template.id}
                        className="bg-accent/5 rounded-lg overflow-hidden hover:bg-accent/10 transition-colors"
                      >
                        <div className="p-3">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <h5 className="font-medium text-foreground text-sm mb-1">
                                {template.name}
                              </h5>
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {template.description}
                              </p>
                            </div>

                            <div className="flex items-center gap-1 ml-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => handleCopyTemplate(template)}
                                title="Copy to clipboard"
                              >
                                <Copy className="w-3 h-3" />
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-3 text-xs"
                                onClick={() => handleUseTemplate(template)}
                              >
                                <Play className="w-3 h-3 mr-1" />
                                Use
                              </Button>
                            </div>
                          </div>

                          {/* Required packages */}
                          {template.requiredPackages &&
                            template.requiredPackages.length > 0 && (
                              <div className="flex items-center gap-1 mb-2">
                                <Package className="w-3 h-3 text-secondary" />
                                <span className="text-xs text-muted-foreground">
                                  Requires:{' '}
                                  {template.requiredPackages.join(', ')}
                                </span>
                              </div>
                            )}

                          {/* Expand/collapse code preview */}
                          <button
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-muted-foreground transition-colors"
                            onClick={() =>
                              setExpandedTemplate(
                                expandedTemplate === template.id
                                  ? null
                                  : template.id
                              )
                            }
                          >
                            <ChevronRight
                              className={`w-3 h-3 transition-transform ${
                                expandedTemplate === template.id
                                  ? 'rotate-90'
                                  : ''
                              }`}
                            />
                            <Code2 className="w-3 h-3" />
                            {expandedTemplate === template.id
                              ? 'Hide'
                              : 'Show'}{' '}
                            code
                          </button>
                        </div>

                        {/* Code preview */}
                        {expandedTemplate === template.id && (
                          <div className="border-t border-border bg-popover/20">
                            <pre className="text-xs text-muted-foreground p-3 overflow-x-auto max-h-64 overflow-y-auto">
                              <code>{template.code}</code>
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              }
            )}
          </div>
        )}
      </div>

      {/* Footer with template count */}
      <div className="border-t border-border p-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {filteredTemplates.length} templates
            {selectedCategory &&
              ` in ${
                CATEGORY_CONFIG[
                  selectedCategory as keyof typeof CATEGORY_CONFIG
                ].label
              }`}
          </span>

          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-primary hover:text-primary/80 transition-colors"
            >
              Clear search
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScriptTemplates;
