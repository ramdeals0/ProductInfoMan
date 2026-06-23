# ProductInfoMan

Product Information Management (PIM) system built with [Prisma](https://www.prisma.io/) and TypeScript.

## Prerequisites

- Node.js 20+
- npm

## Getting Started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment**

   ```bash
   cp .env.example .env
   ```

3. **Run database migrations**

   ```bash
   npm run db:migrate
   ```

4. **Seed sample data**

   ```bash
   npm run db:seed
   ```

## Scripts

| Script | Description |
| --- | --- |
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:migrate` | Apply migrations in development |
| `npm run db:push` | Push schema changes without migrations |
| `npm run db:seed` | Seed the database with sample products |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:reset` | Reset the database |

## Data Model

### Product

| Field | Type | Description |
| --- | --- | --- |
| `id` | Int | Auto-incrementing primary key |
| `sku` | String | Unique stock-keeping unit |
| `name` | String | Product name |
| `description` | String? | Optional product description |
| `price` | Decimal | Product price |
| `quantity` | Int | Available stock quantity |
| `createdAt` | DateTime | Record creation timestamp |
| `updatedAt` | DateTime | Last update timestamp |

## Project Structure

```
productinfoman/
├── prisma/
│   ├── schema.prisma    # Database schema
│   ├── seed.ts          # Seed script
│   └── migrations/      # Migration history
├── src/
│   └── lib/
│       └── prisma.ts    # Prisma Client singleton
├── generated/
│   └── prisma/          # Generated Prisma Client
├── prisma.config.ts     # Prisma configuration
└── .env.example         # Environment variable template
```

## License

ISC
