# Gallery Spider

A web crawler system designed to collect media content from Weibo topics and user posts using a producer-consumer architecture.

一个使用生产者-消费者架构设计的网络爬虫系统，用于收集微博话题和用户帖子中的媒体内容。

## Features / 功能特点

- Producer-consumer architecture for efficient data collection
- Support for Weibo topic crawling
- Support for Weibo user posts crawling
- Media content (images/videos) downloading and processing
- Database storage using Prisma
- Automated testing with Vitest

## Prerequisites / 环境要求

- Node.js >= 16
- [pnpm](https://pnpm.io/) package manager
- Database (supported by Prisma)

## Installation / 安装

```bash
# Install dependencies / 安装依赖
pnpm install

# Setup database / 初始化数据库
pnpm run migrate
```

## Usage / 使用方法

```bash
# Run producer to collect data / 运行生产者收集数据
pnpm run produce

# Run consumer to process data / 运行消费者处理数据
pnpm run consume

# Run tests / 运行测试
pnpm run test

# Run tests in watch mode / 以监听模式运行测试
pnpm run test:watch
```

## Project Structure / 项目结构

```
src/
├── producers/         # Data collection modules / 数据收集模块
│   ├── weiboTopic/   # Weibo topic crawler / 微博话题爬虫
│   └── weiboperson/  # Weibo user posts crawler / 微博用户帖子爬虫
├── consumer/         # Data processing modules / 数据处理模块
├── db/              # Database models and operations / 数据库模型和操作
├── utils/           # Utility functions / 工具函数
└── types/           # TypeScript type definitions / TypeScript 类型定义
```

## Dependencies / 依赖

- `@prisma/client` - Database ORM
- `axios` - HTTP client
- `playwright` - Browser automation
- `sharp` - Image processing
- `vitest` - Testing framework

## Development / 开发

The project uses TypeScript and follows a modular architecture. The producer modules collect data from Weibo, while the consumer modules process and store the collected data.

项目使用 TypeScript 开发，采用模块化架构。生产者模块负责从微博收集数据，消费者模块负责处理和存储收集到的数据。

## License / 许可证

MIT
