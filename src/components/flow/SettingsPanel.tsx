import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconX, IconCheck } from '@tabler/icons-react';
import { clsx } from 'clsx';
import { useSettingsStore, ACCENT_PRESETS } from '@/store/settingsStore';
import anthropicIcon from '@/assets/anthropic.webp';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const {
    theme,
    toggleTheme,
    accentColor,
    setAccentPreset,
    anthropicApiKey,
    setAnthropicApiKey,
  } = useSettingsStore();

  const [apiKeyInput, setApiKeyInput] = useState(anthropicApiKey);
  const [activeTab, setActiveTab] = useState<'appearance' | 'ai'>('ai');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setApiKeyInput(anthropicApiKey);
      setSaved(false);
    }
  }, [isOpen, anthropicApiKey]);

  const handleSaveApiKey = useCallback(() => {
    setAnthropicApiKey(apiKeyInput);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, [apiKeyInput, setAnthropicApiKey]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '1' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setActiveTab('ai'); }
      if (e.key === '2' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setActiveTab('appearance'); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const currentPresetName = ACCENT_PRESETS.find(
    p => p.hue === accentColor.hue &&
         p.saturation === accentColor.saturation &&
         p.lightness === accentColor.lightness
  )?.name;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="fixed inset-0 bg-black/50 z-[100]"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.12 }}
            className="fixed top-[18%] left-1/2 -translate-x-1/2 w-full max-w-[400px] z-[100]"
          >
            <div
              className="mx-4 rounded-xl overflow-hidden shadow-lg"
              style={{
                backgroundColor: 'var(--surface-primary)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-5 py-4"
                style={{ borderBottom: '1px solid var(--border-subtle)' }}
              >
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  Settings
                </span>
                <button
                  onClick={onClose}
                  className="p-1.5 -mr-1 rounded-lg transition-colors hover:bg-[var(--surface-secondary)]"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  <IconX size={16} stroke={2} />
                </button>
              </div>

              {/* Tabs */}
              <div
                className="flex px-5 pt-3 gap-6"
                style={{ borderBottom: '1px solid var(--border-subtle)' }}
              >
                <TabButton
                  active={activeTab === 'ai'}
                  onClick={() => setActiveTab('ai')}
                  shortcut="⌘1"
                  icon={<img src={anthropicIcon} alt="" className="w-3.5 h-3.5 opacity-70 invert dark:invert-0" />}
                >
                  AI
                </TabButton>
                <TabButton
                  active={activeTab === 'appearance'}
                  onClick={() => setActiveTab('appearance')}
                  shortcut="⌘2"
                >
                  Appearance
                </TabButton>
              </div>

              {/* Content */}
              <div className="px-5 py-6">
                <AnimatePresence mode="wait">
                  {activeTab === 'ai' && (
                    <motion.div
                      key="ai"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.1 }}
                      className="space-y-5"
                    >
                      {/* API Key */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] flex items-center gap-2" style={{ color: 'var(--text-tertiary)' }}>
                          Anthropic API Key
                          </span>
                          <span
                            className="text-[11px] flex items-center gap-1.5"
                            style={{ color: anthropicApiKey ? 'var(--success)' : 'var(--text-disabled)' }}
                          >
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: anthropicApiKey ? 'var(--success)' : 'var(--text-disabled)' }} />
                            {anthropicApiKey ? 'Connected' : 'Not set'}
                          </span>
                        </div>
                        <input
                          type="password"
                          value={apiKeyInput}
                          onChange={(e) => setApiKeyInput(e.target.value)}
                          placeholder="sk-ant-api03-..."
                          className="w-full px-3.5 py-2.5 rounded-lg text-xs font-mono outline-none transition-colors"
                          style={{
                            backgroundColor: 'var(--surface-secondary)',
                            border: '1px solid var(--border-default)',
                            color: 'var(--text-primary)',
                          }}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveApiKey}
                            disabled={apiKeyInput === anthropicApiKey}
                            className="flex-1 px-4 py-2 text-xs font-medium rounded-lg transition-colors disabled:opacity-40"
                            style={{
                              backgroundColor: saved ? 'var(--success)' : 'var(--primary)',
                              color: 'white',
                            }}
                          >
                            {saved ? 'Saved' : 'Save'}
                          </button>
                          {anthropicApiKey && (
                            <button
                              onClick={() => {
                                setApiKeyInput('');
                                setAnthropicApiKey('');
                              }}
                              className="px-4 py-2 text-xs rounded-lg transition-colors"
                              style={{
                                backgroundColor: 'var(--surface-secondary)',
                                color: 'var(--text-secondary)',
                              }}
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        <p className="text-[11px]" style={{ color: 'var(--text-disabled)' }}>
                          Stored locally only
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'appearance' && (
                    <motion.div
                      key="appearance"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.1 }}
                      className="space-y-6"
                    >
                      {/* Theme */}
                      <SettingRow label="Theme">
                        <div
                          className="flex rounded-lg p-1"
                          style={{ backgroundColor: 'var(--surface-secondary)' }}
                        >
                          <button
                            onClick={() => theme !== 'light' && toggleTheme()}
                            className={clsx(
                              "px-4 py-1.5 text-xs rounded-md transition-colors",
                              theme === 'light'
                                ? "shadow-sm"
                                : ""
                            )}
                            style={{
                              backgroundColor: theme === 'light' ? 'var(--surface-primary)' : 'transparent',
                              color: theme === 'light' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                            }}
                          >
                            Light
                          </button>
                          <button
                            onClick={() => theme !== 'dark' && toggleTheme()}
                            className={clsx(
                              "px-4 py-1.5 text-xs rounded-md transition-colors",
                              theme === 'dark'
                                ? "shadow-sm"
                                : ""
                            )}
                            style={{
                              backgroundColor: theme === 'dark' ? 'var(--surface-primary)' : 'transparent',
                              color: theme === 'dark' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                            }}
                          >
                            Dark
                          </button>
                        </div>
                      </SettingRow>

                      {/* Accent Color */}
                      <SettingRow label="Accent">
                        <div className="flex gap-2.5">
                          {ACCENT_PRESETS.map((preset) => {
                            const color = `hsl(${preset.hue}, ${preset.saturation}%, ${preset.lightness}%)`;
                            const isSelected = currentPresetName === preset.name;
                            return (
                              <button
                                key={preset.name}
                                onClick={() => setAccentPreset(preset.name)}
                                className={clsx(
                                  "w-7 h-7 rounded-full transition-all flex items-center justify-center",
                                  isSelected
                                    ? "ring-2 ring-offset-2"
                                    : "hover:ring-2 hover:ring-offset-2"
                                )}
                                style={{
                                  backgroundColor: color,
                                  ['--tw-ring-color' as string]: isSelected ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                                  ['--tw-ring-offset-color' as string]: 'var(--surface-primary)',
                                }}
                                title={preset.name}
                              >
                                {isSelected && (
                                  <IconCheck size={12} stroke={3} className="text-white" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </SettingRow>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div
                className="px-5 py-3 flex items-center justify-between"
                style={{
                  borderTop: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--surface-secondary)',
                }}
              >
                <span className="text-[11px]" style={{ color: 'var(--text-disabled)' }}>
                  esc to close
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function TabButton({
  active,
  onClick,
  shortcut,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  shortcut: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="relative pb-3 text-[13px] transition-colors flex items-center gap-2"
      style={{ color: active ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
    >
      {icon}
      {children}
      <span
        className="text-[10px]"
        style={{ color: 'var(--text-disabled)' }}
      >
        {shortcut}
      </span>
      {active && (
        <motion.div
          layoutId="tab-indicator"
          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
          style={{ backgroundColor: 'var(--text-primary)' }}
        />
      )}
    </button>
  );
}

function SettingRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px]" style={{ color: 'var(--text-tertiary)' }}>
        {label}
      </span>
      {children}
    </div>
  );
}

export default SettingsPanel;
