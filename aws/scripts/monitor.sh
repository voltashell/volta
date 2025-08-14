#!/usr/bin/env bash
set -euo pipefail

# Configuration
STACK_NAME=${STACK_NAME:-ai-flock}
AWS_REGION=${AWS_REGION:-us-east-1}

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

echo_header() {
    echo -e "${BLUE}=========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}=========================================${NC}"
}

# Get cluster name
CLUSTER_NAME=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query "Stacks[0].Outputs[?OutputKey=='ClusterName'].OutputValue" \
    --output text \
    --region $AWS_REGION 2>/dev/null)

if [ -z "$CLUSTER_NAME" ]; then
    echo_info "Stack $STACK_NAME not found. Please deploy first."
    exit 1
fi

while true; do
    clear
    
    echo_header "AI Flock Monitor - $(date)"
    
    # Show services
    echo -e "\n${YELLOW}Services:${NC}"
    aws ecs list-services --cluster $CLUSTER_NAME --region $AWS_REGION --output table
    
    # Show running tasks
    echo -e "\n${YELLOW}Running Tasks:${NC}"
    TASKS=$(aws ecs list-tasks --cluster $CLUSTER_NAME --region $AWS_REGION --query 'taskArns' --output json)
    
    if [ "$TASKS" != "[]" ]; then
        aws ecs describe-tasks \
            --cluster $CLUSTER_NAME \
            --tasks $(echo $TASKS | jq -r '.[]') \
            --region $AWS_REGION \
            --query 'tasks[].{Task:taskArn,Status:lastStatus,DesiredStatus:desiredStatus,CPU:cpu,Memory:memory}' \
            --output table
    else
        echo "No running tasks"
    fi
    
    # Show recent logs
    echo -e "\n${YELLOW}Recent Agent Logs:${NC}"
    aws logs tail /ecs/ai-flock-agent --since 1m --region $AWS_REGION 2>/dev/null | head -20 || echo "No recent logs"
    
    echo -e "\n${GREEN}Refreshing in 10 seconds... (Press Ctrl+C to exit)${NC}"
    sleep 10
done