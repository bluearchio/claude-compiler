# Setup Guide

## Prerequisites

1. **Bash**: Version 3.2+ (macOS) or 4.0+ (Linux)
2. **Claude CLI**: Install via npm
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```
3. **SQLite3**: Usually pre-installed on most systems

## Installation

1. Clone the repository:
   ```bash
   git clone [repository-url]
   cd claude-compiler
   ```

2. Make the script executable:
   ```bash
   chmod +x claude-compiler.sh
   ```

3. Initialize the databases:
   ```bash
   ./claude-compiler.sh init
   ```

## Verification

Test the installation:
```bash
# Check help
./claude-compiler.sh help

# Start a test session
./claude-compiler.sh start test-project

# Send a test prompt
./claude-compiler.sh "Hello, Claude"

# End the session
./claude-compiler.sh end
```

## Troubleshooting

### Claude command not found
- Ensure Claude CLI is installed: `npm install -g @anthropic-ai/claude-code`
- Check PATH includes npm global directory

### Bash syntax errors
- macOS uses Bash 3.2 by default
- Script is compatible with both Bash 3.2 and 4.0+

### Database errors
- Run `./claude-compiler.sh init` to initialize databases
- Check write permissions in the `db/` directory

### Session conflicts
- Use `./claude-compiler.sh status` to check active sessions
- Use `./claude-compiler.sh end` to close stale sessions