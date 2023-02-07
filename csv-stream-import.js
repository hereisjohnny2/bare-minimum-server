import { parse } from 'csv-parse';
import fs from "node:fs"

const filePath = new URL("tasks_data.csv", import.meta.url)

async function parseCSV() {
    const csvFileParser = fs.createReadStream(filePath)
        .pipe(parse({
            delimiter: ",",
            skipEmptyLines: true,
            fromLine: 2
        }))

    for await (const record of csvFileParser) {
        const [title, description] = record
        await fetch("http://localhost:3333/tasks", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ title, description })
        })
    }
}

parseCSV()

