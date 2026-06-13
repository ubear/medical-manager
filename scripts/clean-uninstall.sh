#!/usr/bin/env bash
# 医疗指标管理系统 — macOS 一键彻底卸载脚本
# 用法: bash clean-uninstall.sh
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m'

PRODUCT_NAME="MedicalManager"
DATA_DIR="$HOME/Library/Application Support/com.yyproject.medical-manager"
APP_PATH="/Applications/${PRODUCT_NAME}.app"

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  医疗指标管理系统 — 彻底卸载${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# ---- 1. 杀掉运行中的进程 ----
echo -e "${YELLOW}[1/3] 检查运行中的程序...${NC}"
if pgrep -f "${PRODUCT_NAME}" > /dev/null 2>&1; then
    echo -e "${GRAY}  正在终止 ${PRODUCT_NAME} 进程...${NC}"
    pkill -f "${PRODUCT_NAME}" 2>/dev/null || true
    sleep 1
    echo -e "${GREEN}  已终止${NC}"
else
    echo -e "${GRAY}  未运行${NC}"
fi

# ---- 2. 删除应用数据 ----
echo -e "${YELLOW}[2/3] 删除应用数据...${NC}"
if [ -d "$DATA_DIR" ]; then
    echo -e "${GRAY}  路径: ${DATA_DIR}${NC}"
    rm -rf "$DATA_DIR"
    echo -e "${GREEN}  已删除（含数据库、配置等）${NC}"
else
    echo -e "${GRAY}  未找到: ${DATA_DIR}${NC}"
fi

# ---- 3. 删除应用程序 ----
echo -e "${YELLOW}[3/3] 删除应用程序...${NC}"
if [ -d "$APP_PATH" ]; then
    echo -e "${GRAY}  路径: ${APP_PATH}${NC}"
    rm -rf "$APP_PATH"
    echo -e "${GREEN}  已删除${NC}"
else
    echo -e "${GRAY}  未找到: ${APP_PATH}${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  卸载完成，系统已清理干净。${NC}"
echo -e "${GREEN}========================================${NC}"
