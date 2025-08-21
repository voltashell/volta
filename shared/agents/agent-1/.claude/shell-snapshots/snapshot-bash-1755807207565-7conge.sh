# Snapshot file
# Unset all aliases to avoid conflicts with functions
unalias -a 2>/dev/null || true
shopt -s expand_aliases
# Check for rg availability
if ! command -v rg >/dev/null 2>&1; then
  alias rg='/usr/local/lib/node_modules/\@anthropic-ai/claude-code/vendor/ripgrep/arm64-linux/rg'
fi
export PATH=/usr/local/bin\:/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin
