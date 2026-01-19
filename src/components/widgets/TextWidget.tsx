interface TextWidgetProps {
  config: Record<string, unknown>;
}

export function TextWidget({ config }: TextWidgetProps) {
  const { content = "Click to edit text..." } = config as { content?: string };
  
  return (
    <div className="text-foreground text-sm">
      {content}
    </div>
  );
}
