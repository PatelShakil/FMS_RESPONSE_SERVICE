# BoloIndia Response Service 🚀

Citizen feedback response submission and management microservice for the BoloIndia platform.

## 📋 Overview

The Response Service handles:
- **Response Submission**: Accept citizen feedback (anonymous & authenticated)
- **Response Management**: Review, resolve, flag, and reply to responses
- **File Uploads**: Handle images, videos, and audio via MinIO
- **Analytics**: Real-time and historical response analytics
- **Data Export**: Export responses as CSV, Excel, and PDF
- **Spam Detection**: Automatic spam scoring and detection
- **Event Streaming**: Kafka integration for event-driven architecture

## 🏗️ Architecture

- **Runtime**: Node.js 20 LTS
- **Framework**: Express.js
- **Database**: MongoDB (NoSQL for flexible response schema)
- **Storage**: MinIO (S3-compatible object storage)
- **Messaging**: Kafka (event streaming)
- **Authentication**: JWT (MicroProfile JWT compatible)
- **Documentation**: Swagger/OpenAPI

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- MongoDB
- Kafka
- MinIO
- JWT public key from auth-service

### Installation

