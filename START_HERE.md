# PlayHub - Beginner guide (VS Code + Docker)

This project is **ready to run**. A `.env` file with strong, randomly generated passwords is
already in this folder, so there is nothing to configure.

You need two free programs installed first:

- **Docker Desktop** - https://www.docker.com/products/docker-desktop (open it once and wait until
  it says it is running; the whale icon in the taskbar stops animating)
- **Visual Studio Code** - https://code.visualstudio.com

---

## Step 1 - Extract the ZIP

1. Right-click `PlayHub-upgraded.zip` -> **Extract All...** -> choose a place such as `Documents`.
2. Open the extracted folder. Keep opening folders until you see these files together:
   `docker-compose.yml`, `README.md`, `START_HERE.md`, and the folders `frontend`, `poll-api`, `db`.
   **That folder is your project folder.**

> The `.env` file starts with a dot, so Windows Explorer may hide it. It is there. VS Code will
> show it in the next step.

## Step 2 - Open the folder in VS Code

1. Start **Visual Studio Code**.
2. Menu **File -> Open Folder...**
3. Select the project folder from Step 1 (the one containing `docker-compose.yml`) and click
   **Select Folder**.
4. If VS Code asks *"Do you trust the authors?"* click **Yes, I trust the authors**.
5. The left sidebar (Explorer) now lists `.env`, `docker-compose.yml`, `frontend`, `poll-api`, ...

## Step 3 - Open the terminal inside VS Code

Menu **Terminal -> New Terminal** (or press **Ctrl + `**, the key above Tab).

A panel opens at the bottom. Check you are in the right place:

```
dir
```

You must see `docker-compose.yml` in the list. If you don't, you opened the wrong folder:
go back to Step 2.

## Step 4 - Start everything

Make sure Docker Desktop is running, then type this exact command and press Enter:

```
docker compose up -d --build
```

- The **first start takes about 3-6 minutes**: Docker downloads MySQL and builds the app. Later
  starts take seconds.
- While building, the API's automated tests run (170 tests). If any failed, the build would stop.
- When the prompt comes back, check that everything is healthy:

```
docker compose ps
```

You want to see `db`, `poll-api`, `frontend` and `proxy` with **Up ... (healthy)**. If one says
`(health: starting)`, wait 30 seconds and run the command again.

## Step 5 - Open the app

Open your browser at:

### http://localhost:8080

1. Click **Create an account** and sign up (any username, an email, a password of 8+ characters).
2. Try it: **New poll** (attach a photo!), vote, comment, set an avatar on your profile,
   and use the sun/moon button to switch dark/light mode.
3. Make a second account in a private window to try following and comments between users.

## Step 6 - See the database in your browser (phpMyAdmin)

Open: **http://localhost:8081**

1. **Username:** `root`
2. **Password:** the value of `MYSQL_ROOT_PASSWORD` in the `.env` file (open `.env` in VS Code
   and copy the text after the `=`).
3. Click **Go**. In the left column click **pollsdb**.

You will see the tables: `users`, `polls`, `options`, `votes`, `comments`, `follows`,
`poll_images` and `user_avatars`. Click a table, then **Browse** to see its rows. Passwords are
stored as bcrypt hashes, never as readable text.

> This page only works on your own computer (it is not reachable from the network).

---

## Everyday commands (run them in the VS Code terminal)

| What you want | Command |
| --- | --- |
| Stop the app (keeps all data) | `docker compose down` |
| Start it again | `docker compose up -d` |
| Start again after you changed code | `docker compose up -d --build` |
| Watch the API log | `docker compose logs -f poll-api` (Ctrl+C to leave) |
| **Erase everything** (users, polls, images) and start fresh | `docker compose down -v` then `docker compose up -d --build` |

---

## If something goes wrong

**"error during connect ... pipe/dockerDesktopLinuxEngine" or "Cannot connect to the Docker daemon"**
Docker Desktop is not running. Start it, wait until it says *Running*, retry.

**You ran an older version of this project before (poll-api is unhealthy, log says "Access denied")**
The old database volume still has the old passwords. Reset it once:
```
docker compose down -v
docker compose up -d --build
```
(This deletes the old test data.)

**"port is already allocated" / "address already in use"**
Something else uses port 8080 (or 8081). Open `.env`, change `HTTP_PORT=8080` to e.g.
`HTTP_PORT=8090`, also change `CORS_ORIGIN=http://localhost:8080` to the same port, run
`docker compose up -d --build`, and open that port instead. For 8081, edit the number in
`docker-compose.override.yml`.

**The page does not load right after starting**
Run `docker compose ps`. Wait until all four services show *healthy* (the first start can take a
minute or two while MySQL initialises), then refresh.

**Still stuck?** Run `docker compose logs --tail=50` and read the last lines, or send them to
whoever is helping you.

---

## Before putting this on the internet

The passwords in `.env` are random and strong, which is fine for your own computer. For a public
server, generate **new** ones, never share this `.env`, and follow **UPGRADE.md -> Production
deployment** (HTTPS, closed ports, backups).
