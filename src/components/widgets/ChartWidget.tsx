interface ChartWidgetProps {
  config: Record<string, unknown>;
}

export function ChartWidget({ config }: ChartWidgetProps) {
  return (
    <div className="flex items-center justify-center h-full text-foreground-muted">
      <div className="text-center">
        <div className="text-sm">Chart Widget</div>
        <div className="text-xs mt-1">Connect data to visualize</div>
      </div>
    </div>
  );
}
