import http from "node:http"
import { randomUUID } from "node:crypto"
import fs from "node:fs/promises"
import { warn } from "node:console"

const databasePath = new URL("db.json", import.meta.url)

class LocalFileDatabase {
    #database = {}

    constructor() {
        fs.readFile(databasePath, "utf8")
            .then(data => {
                this.#database = JSON.parse(data)
            })
            .catch(() => this.#persist())
    }

    #persist() {
        fs.writeFile(databasePath, JSON.stringify(this.#database))
    }

    select(table) {
        const data = this.#database[table] ?? []

        return data
    }

    insert(table, data) {
        if (Array.isArray(this.#database[table])) {
            this.#database[table].push(data)
        } else {
            this.#database[table] = [data]
        }

        this.#persist()

        return data
    }

    update(table, id, data) {
        const rowIndex = this.#database[table]?.findIndex(row => row.id === id)

        if (rowIndex == undefined || rowIndex < 0) return false

        this.#database[table][rowIndex] = { id, ...data }
        this.#persist()

        return true
    }

    delete(table, id) {
        const rowIndex = this.#database[table]?.findIndex(row => row.id === id)

        if (rowIndex == undefined || rowIndex < 0) return false

        this.#database[table].splice(rowIndex, 1)
        this.#persist()

        return true
    }
}

const database = new LocalFileDatabase()

function buildRoutePath(path) {
    const routeParametersRegex = /:([a-zA-Z]+)/g
    const pathWithParams = path.replaceAll(routeParametersRegex, "(?<$1>[a-z0-9\-_]+)")
    const pathRegex = new RegExp(`^${pathWithParams}`)

    return pathRegex
}

const routes = [
    {
        method: "GET",
        url: buildRoutePath("/tasks"),
        handler: (_, res) => {
            const data = database.select("tasks")
            return res.end(JSON.stringify(data))
        }
    },
    {
        method: "POST",
        url: buildRoutePath("/tasks"),
        handler: (req, res) => {
            const { description } = req.body

            const data = {
                id: randomUUID(),
                description
            }

            database.insert("tasks", data)

            return res.writeHead(201).end()
        }
    },
    {
        method: "PUT",
        url: buildRoutePath("/tasks/:id"),
        handler: (req, res) => {
            const { id } = req.params
            const { description } = req.body

            const data = { description }
            const hasUpdated = database.update("tasks", id, data)

            if (!hasUpdated) {
                return res.writeHead(404).end(JSON.stringify({ message: "id not found" }))
            }

            return res.writeHead(204).end()
        }
    },
    {
        method: "DELETE",
        url: buildRoutePath("/tasks/:id"),
        handler: (req, res) => {
            const { id } = req.params

            const hasDeleted = database.delete("tasks", id)

            if (!hasDeleted) {
                return res.writeHead(404).end(JSON.stringify({ message: "id not found" }))
            }

            return res.writeHead(204).end()
        }
    }
]

async function json(req, res) {
    const buffers = []

    for await (const chunk of req) {
        buffers.push(chunk)
    }

    try {
        req.body = JSON.parse(Buffer.concat(buffers).toString())
    } catch {
        req.body = null
    }

    res.setHeader("Content-Type", "application/json")
}

const server = http.createServer(async (req, res) => {
    const { method, url } = req

    await json(req, res)

    const route = routes.find(route => route.method == method && route.url.test(url))
    if (route) {
        const routeParam = req.url.match(route.url)
        const params = { ...routeParam.groups }

        req.params = params

        return route.handler(req, res)
    }

    return res.writeHead(404).end()
})

server.listen(3333, () => console.log("Server on http://localhost:3333"))

