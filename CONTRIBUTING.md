# Contributing to DataKit

Thank you for your interest in contributing to DataKit! We welcome contributions from the community to help make this the best private data analysis studio.

## 📂 Project Structure

DataKit is a monorepo-style project with separate directories for the frontend and backend.

- **`frontend/`**: Result of a React + Vite application. This contains the UI code.
- **`backend/api/`**: A NestJS application that provides the API, manages database connections, and handles authentication.
- **`docker/`**: Contains Docker configurations and scripts for containerizing the application.

## 🛠 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v20.15.1 or higher)
- **npm** (v9.0.0 or higher)
- **Docker** & **Docker Compose** (optional, for running the full stack easily)

## 🚀 Development Workflow

You can run the frontend and backend independently or together.

### Frontend Development

The frontend is a React application built with Vite.

1.  **Navigate to the frontend directory:**
    ```bash
    cd frontend
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Environment Setup:**
    Copy `.env.development` (if it exists) or ensure you have the necessary environment variables. By default, it expects the backend to be at `http://localhost:3001/api`.

4.  **Start the development server:**
    ```bash
    npm run dev
    ```
    The application will typically run on `http://localhost:5173`.

### Backend Development

The backend is a NestJS API.

1.  **Navigate to the backend directory:**
    ```bash
    cd backend/api
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Environment Setup:**
    Create a `.env` file in `backend/api/`. You can copy `.env.example` if available, or set the following minimal keys:
    ```env
    PORT=3001
    DATABASE_URL=... # Your Postgres connection string
    # See backend/api/README.md (if available) for more details
    ```

4.  **Start the development server:**
    ```bash
    npm run start:dev
    ```
    The API will run on `http://localhost:3001`.

### Running with Docker

For a full stack experience without manually starting each service, you can use the Docker setup.

1.  **Navigate to the docker directory:**
    ```bash
    cd docker
    ```

2.  **Run with Docker Compose:**
    ```bash
    docker-compose up --build
    ```
    This will spin up the frontend, backend, and potentially a database depending on the configuration in `docker-compose.yml`.

## 📝 Pull Request Guidelines

1.  **Fork the repository** and create your branch from `main`.
2.  **Naming convention**: Use descriptive branch names (e.g., `feature/add-new-chart`, `fix/login-bug`).
3.  **Commit messages**: Please use clear and concise commit messages.
4.  **Tests**: Ensure your changes don't break existing functionality. Run tests if applicable (`npm run test` in respective directories).
5.  **Documentation**: Update READMEs or this guide if you change how to run or configure the project.
6.  **Linting**: Ensure your code is formatted correctly.

## 🤝 Need Help?

If you have questions, feel free to reach out in our [Discord](https://discord.com/invite/gZmXmhbBdP) or open an issue on GitHub.

Happy Coding!
