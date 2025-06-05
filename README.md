# Project Overview

This project is a web application that indexes the [Altered TCG](https://www.altered.gg/) marketplace and tries to provide a more user-friendly interface to search for unique cards. It does not try to index prices for Rares and Commons, since those can be easily found on the Altered website.

You can find the live version of the app at [https://market.sabotageafter.rest](https://market.sabotageafter.rest).

# Docs for libraries used in this project

- 📖 [Typescript docs](https://www.typescriptlang.org/docs/)
- 📖 [Remix docs](https://remix.run/docs)
- 📖 [Prisma docs](https://www.prisma.io/docs)
- 📖 [Tailwind CSS docs](https://tailwindcss.com/docs)
- 📖 [shadcn/ui](https://ui.shadcn.com/docs)

# Getting started with development

## Prerequisites

- Node.js environement (v22)
- A Docker executable ([Docker Desktop for Windows/Mac](https://www.docker.com/products/docker-desktop/), or [podman on Linux](https://podman.io/))
- PostgreSQL CLI tools (`psql`, `createdb` commands). Download from [postgresql.org/download](https://www.postgresql.org/download/).
- A text editor or IDE (I recommend [VSCode](https://code.visualstudio.com/))

### Step 1: Create a local .env file

Create a `.env` file in the root of the project. Paste the contents of this example file:
```
# used by Prisma
DATABASE_URL="postgresql://test:test@localhost:5411/test"

# used by docker-compose / pg-admin
POSTGRES_DB=test
POSTGRES_USER=test
POSTGRES_PASSWORD=test

# For the marketplace crawler - this is an internal ID for the Database, it can be anything
ALT_SESSION_NAME=my-dev-account
```

### Step 2: Run a local PostgreSQL database

There is a `docker-compose.yml` file in the root of the project that will run a containerized PostgreSQL database along with a `pgAdmin` instance.

```
docker compose up -d
```

The database will run on port 5411, and the `pgAdmin` instance will run on port 5412. Note that this is not the standard port for PostgreSQL (which is 5432), so you will need to specify this port when connecting from the CLI.

When done, you can stop the containers with `docker compose down`.

### Step 3: Create a new database

```
createdb -p 5411 -U test -h localhost -W mydatabase
```

### Step 4 (Optional): Download a dump of the database

> This will allow you to test the UI with a full dataset without having to run the crawler manually.
>
> Download it from [Google Drive : marketbot_export_2025-06-04_clean.7z]https://drive.google.com/file/d/1Y8beYTkE_qxlWtyoeua6yb2CmCfLpPMk/view?usp=sharing) and decompress it.

Once you have the file, you can import using the `psql` CLI:

```
psql -p 5411 -U test -h localhost -d mydatabase -f marketbot_export_2025-05-21_clean.sql
```

### Step 5: Download `npm` dependencies

```
npm install
```

### Step 6: Run Prisma migrations

There might be some new migrations that have been added since this dump was created. You can run the following command to apply them:

```
npx prisma migrate dev
```

### We're ready to go!

At this point, all the one-time setup is done. You should be able to run the app and crawler locally using the commands below.


## Run the app

Start the Remix dev server with:
```
npm run dev
```

The app will run on [http://localhost:5173](http://localhost:5173) by default, or another port if it's already in use. This will be shown on the terminal.

### Prisma Studio

Prisma Studio is a tool that allows you to view the data in your database. It uses the information from the `schema.prisma` file to generate a UI, making this more lightweight than using a Database GUI like `pgAdmin`.

You can start it with the following command:
```
npx prisma studio
```

# Project Outline and Architecture

## Database / Prisma

Prisma is a ORM that generates a Typescript library to interact with the database.

The `schema.prisma` file defines the structure of the database, and the relations between the tables.

The `migrations` folder contains the history of the changes made to the database, and any change to the `schema.prisma` file should be accompanie by a migration. See [(Prisma Docs) Prototyping your schema](https://www.prisma.io/docs/orm/prisma-migrate/workflows/prototyping-your-schema) for more information.

Run `npx prisma migrate dev` to generate a migration and apply your schema changes to the database.

To query the database, see [(Prisma Docs) Querying the database](https://www.prisma.io/docs/orm/prisma-client/queries) or follow examples for the codebase.

Both the Crawler and the Web UI use the same Prisma client to interact with the database.

## Web UI / Remix

The web UI is built with Remix, a React framework for server-side rendering (SSR). Everything related to the UI is in the `app/` folder:
* `app/routes/` is the main entry point for the web UI. It lists all the URLs supported by the app.
* `app/components/` contains reusable React components.
  * `app/components/ui/` contains [Shadcn/ui](https://ui.shadcn.com/) components.
* `app/loaders` are `loader` functions, which are only run on the server and get data from the Database to render in the routes (pages). Currently some of the routes have the whole loader logic inside the route file, but they should be extracted to the `loaders` folder eventually.
* The root `/public/` folder contains static assets like images, fonts, and other files that are served as-is.

### Tailwind CSS

This project uses [Tailwind CSS](https://tailwindcss.com/) for styling. The `tailwind.config.ts` file contains the configuration for the project, and the `app/tailwind.css` file contains some global styles.

### Shadcn/ui

This project uses [Shadcn/ui](https://ui.shadcn.com/) for the UI components. The `app/components/ui` folder contains the components generated by Shadcn/ui. Prefer to use Shadcn/ui components whenever possible rather than rolling your own components. These components are based on [Radix UI Primitives](https://www.radix-ui.com/primitives) and provide good accessibility and consistent styling out of the box.

## Crawler

The `market-crawler` directory contains a simple Node.js application. It is broken down into several components which should each have a specific task:
* `GenericIndexer` is a class that provides a generic implementation of a crawler that can be used enqueue and process requests. It is the base class for the other crawlers:
  * `market` is the Marketplace crawler, it loads all the pages from `api.altered.gg/cards/stats` and records the Unique IDs and current Offer price. This can be run regularly to get the latest offers from the Marketplace.
  * `uniques` fetches Uniques characteristics (name, effects, cost, power, etc.) from the Altered API using the `api.altered.gg/cards/<ID>` endpoint. Each unique should only be fetched once, and the results are saved to the database.
* `refresh-token` provides a `AuthTokenService` that can be used to get a fresh token for the Altered API.
* `post-process` takes the Uniques data and break them down into sub-components (Trigger, Condition, Effect, etc.) and builds to make querying the database faster.

The `main` files provide entry points for each of the tasks, and can be run from the command line using the corresponding `npm` scripts, for example:
```
# runs the market crawler
npm run crawler 

# refreshes the Altered API token (this is also done by the crawler, so only useful for debugging)
npm run crawler-refresh-token

# fetches all the missing uniques from the Altered API
npm run crawler-get-all-uniques 

# run the post-process step on all uniques in database
npm run crawler-post-process
```


