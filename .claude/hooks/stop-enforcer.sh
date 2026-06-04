#!/bin/bash
# ============================================================
# stop-enforcer.sh — Claude Code Stop Hook
# 交付验收强制检查：代码/配置/文档变更必须经过验证才能结束
#
# 退出码：
#   0 — 无变更或已通过验证，允许结束
#   2 — 有变更未验证，触发 asyncRewake 继续工作
# ============================================================

# ---- 防止递归循环 ----
# 如果 stop_hook_active 环境变量为 true，直接放行
if [ "${STOP_HOOK_ACTIVE:-false}" = "true" ]; then
  exit 0
fi

# 也尝试从 stdin JSON 检测（最多等待 0.5 秒）
if [ ! -t 0 ]; then
  STDIN_DATA=$(cat 2>/dev/null) || true
  if [ -n "${STDIN_DATA:-}" ]; then
    case "$STDIN_DATA" in
      *'"stop_hook_active":'*true*) exit 0 ;;
      *'"stop_hook_active" :'*true*) exit 0 ;;
    esac
  fi
fi

# ---- 配置 ----
VERIFICATION_FLAG=".claude/.verification-ok"
INTERESTING_PATTERNS='\.(ts|js|tsx|jsx|py|java|go|rs|c|cpp|h|hpp|rb|php|swift|kt|vue|svelte|json|ya?ml|toml|md|css|scss|less|html|sh|tf|dockerfile|Dockerfile|makefile|Makefile)$'

# ---- 检查 git 变更 ----
GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
cd "$GIT_ROOT"

CHANGED=$(git diff --name-only 2>/dev/null || true)
STAGED=$(git diff --cached --name-only 2>/dev/null || true)
ALL_CHANGES=$(printf "%s\n%s" "$CHANGED" "$STAGED" | grep -v '^$' | sort -u)

if [ -z "$ALL_CHANGES" ]; then
  exit 0
fi

SIGNIFICANT=$(echo "$ALL_CHANGES" | grep -cE "$INTERESTING_PATTERNS" 2>/dev/null || true)
if [ "$SIGNIFICANT" -eq 0 ]; then
  exit 0
fi

# ---- 检查验证标记 ----
if [ -f "$VERIFICATION_FLAG" ]; then
  cat << 'DONE'
##  验证通过

.verification-ok 标记已找到，验证已完成，允许结束。
DONE
  rm -f "$VERIFICATION_FLAG"
  exit 0
fi

# ---- 未验证 → exit 2 触发 rewake ----
cat << 'PROMPT_EOF'
## ⚠️ 交付验收提醒

检测到代码/配置/文档变更，但未完成验证。请执行：

- [ ] **运行测试** — 确保测试通过
- [ ] **Lint 检查** — 确保代码规范
- [ ] **类型检查** — tsc --noEmit 或同等检查
- [ ] **功能验证** — 确认核心功能正常
- [ ] **TODO 检查** — 清理遗留的 TODO

验证通过后运行 `touch .claude/.verification-ok` 标记完成，或直接说明验证结果。
PROMPT_EOF
exit 2
