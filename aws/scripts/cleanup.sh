#!/usr/bin/env bash
set -euo pipefail

# Configuration
STACK_NAME=${STACK_NAME:-ai-flock}
AWS_REGION=${AWS_REGION:-us-east-1}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

echo_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

echo_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Confirm deletion
echo_warn "This will delete the entire AI Flock infrastructure on AWS."
read -p "Are you sure you want to continue? (yes/no): " -r
if [[ ! $REPLY =~ ^[Yy]es$ ]]; then
    echo_info "Cleanup cancelled."
    exit 0
fi

# Delete CloudFormation stack
echo_info "Deleting CloudFormation stack: $STACK_NAME"
aws cloudformation delete-stack --stack-name $STACK_NAME --region $AWS_REGION

echo_info "Waiting for stack deletion to complete..."
aws cloudformation wait stack-delete-complete --stack-name $STACK_NAME --region $AWS_REGION || true

# Delete ECR repository and images
echo_info "Deleting ECR repository..."
aws ecr delete-repository --repository-name ai-flock-agent --force --region $AWS_REGION 2>/dev/null || true

# Clean up CloudWatch Logs (if they still exist)
echo_info "Cleaning up CloudWatch logs..."
aws logs delete-log-group --log-group-name /ecs/ai-flock-nats --region $AWS_REGION 2>/dev/null || true
aws logs delete-log-group --log-group-name /ecs/ai-flock-agent --region $AWS_REGION 2>/dev/null || true

echo_info "Cleanup complete!"