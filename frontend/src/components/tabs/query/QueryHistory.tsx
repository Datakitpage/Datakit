import React, { useState } from "react";
import { SavedQuery } from "@/store/appStore";
import { useQueryHistory } from "@/hooks/query/useQueryHistory";
import {
  Clock,
  Star,
  Trash,
  Copy,
  Check,
  Edit,
  Save,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

interface QueryHistoryProps {
  onSelectQuery: (query: string) => void;
}

/**
 * Displays and manages previously executed and saved queries
 */
const QueryHistory: React.FC<QueryHistoryProps> = ({ onSelectQuery }) => {
  const {
    recentQueries,
    savedQueries,
    saveQuery,
    deleteQuery,
  } = useQueryHistory(onSelectQuery);

  const [activeTab, setActiveTab] = useState<"recent" | "saved">("recent");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingQuery, setEditingQuery] = useState<SavedQuery | null>(null);
  const [editName, setEditName] = useState<string>("");

  // Handle copying to clipboard
  const copyToClipboard = (query: string, id: string) => {
    navigator.clipboard.writeText(query);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Get queries based on active tab
  const queries = activeTab === "recent" ? recentQueries : savedQueries;

  // Format the date nicely
  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();

    // If today, just show time
    if (date.toDateString() === now.toDateString()) {
      return `Today at ${date.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    }

    // If yesterday, show "Yesterday"
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday at ${date.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    }

    // If within last 7 days, show day name
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);
    if (date > sevenDaysAgo) {
      return date.toLocaleDateString(undefined, {
        weekday: "long",
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    // Otherwise show full date
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: now.getFullYear() !== date.getFullYear() ? "numeric" : undefined,
    });
  };

  // Start editing a query name
  const startEditing = (query: SavedQuery) => {
    setEditingQuery(query);
    setEditName(query.name);
  };

  // Save edited query name
  const saveEditedQuery = () => {
    if (!editingQuery || !editName.trim()) return;

    // Save query with new name
    saveQuery(editingQuery.query, editName);

    // Delete old query
    deleteQuery(editingQuery.id);

    // Reset editing state
    setEditingQuery(null);
    setEditName("");
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border">
        <h3 className="text-sm font-medium flex items-center">
          <Clock size={16} className="mr-2 text-primary" />
          <span className="flex items-center">
           
            Query History
            <span className="text-[10px] bg-accent/10 text-muted-foreground px-1.5 py-0.5 rounded ml-1.5">
              from indexedDB
            </span>
          </span>
        </h3>

        {/* Tabs */}
        <div className="flex mt-3 border-b border-border">
          <button
            className={`px-3 py-1.5 text-xs font-medium ${
              activeTab === "recent"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("recent")}
          >
            Recent
          </button>
          <button
            className={`px-3 py-1.5 text-xs font-medium ${
              activeTab === "saved"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("saved")}
          >
            Saved
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-2">
        {queries.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-xs">
            {activeTab === "recent"
              ? "No recent queries. Execute a query to see it here."
              : "No saved queries. Click the star icon to save a query."}
          </div>
        ) : (
          <div className="space-y-2">
            {queries.map((query) => (
              <div
                key={query.id}
                className="p-2 rounded bg-background hover:bg-background/80 border border-border"
              >
                {editingQuery?.id === query.id ? (
                  <div className="flex items-center justify-between mb-1">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 bg-popover px-2 py-1 text-xs rounded border border-border"
                      autoFocus
                    />
                    <div className="flex items-center ml-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setEditingQuery(null)}
                        title="Cancel"
                      >
                        <X size={14} className="text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={saveEditedQuery}
                        title="Save"
                        disabled={!editName.trim()}
                      >
                        <Save size={14} className="text-primary" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between mb-1 group">
                    <div className="text-xs font-medium text-foreground truncate flex-1">
                      {query.name || "Unnamed Query"}
                    </div>
                    <div className="flex items-center space-x-1">
                      {activeTab === "recent" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => saveQuery(query.query, query.name)}
                          title="Save Query"
                        >
                          <Star size={14} className="text-secondary" />
                        </Button>
                      )}

                      {activeTab === "saved" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => startEditing(query)}
                          title="Edit Name"
                        >
                          <Edit size={14} className="text-muted-foreground" />
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => copyToClipboard(query.query, query.id)}
                        title="Copy Query"
                      >
                        {copiedId === query.id ? (
                          <Check size={14} className="text-primary" />
                        ) : (
                          <Copy size={14} className="text-muted-foreground" />
                        )}
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => deleteQuery(query.id)}
                        title="Delete Query"
                      >
                        <Trash size={14} className="text-destructive" />
                      </Button>
                    </div>
                  </div>
                )}

                <div
                  className="text-xs mt-1 p-2 bg-popover/60 rounded font-mono overflow-hidden max-h-20 cursor-pointer"
                  onClick={() => onSelectQuery(query.query)}
                >
                  {query.query.split("\n").slice(0, 3).join("\n")}
                  {query.query.split("\n").length > 3 && (
                    <div className="text-muted-foreground text-center">...</div>
                  )}
                </div>

                <div className="mt-1 flex justify-between items-center">
                  <div className="text-[10px] text-muted-foreground">
                    {formatDate(query.timestamp)}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 py-0 px-2 text-xs"
                    onClick={() => onSelectQuery(query.query)}
                  >
                    Use
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default QueryHistory;
