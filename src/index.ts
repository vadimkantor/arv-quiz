import * as express from "express";
import * as yaml from "js-yaml";
import * as fs from "fs";
import * as cors from "cors";

interface Question {
    taskId: string;
    category: string;
    question: string;
    answers: string[];
    correctAnswer: number;
}

const app = express();
const port = 3000;
app.use(express.json());
app.use(cors());

let questions: Question[] = [];
try {
    const fileContents = fs.readFileSync("questions.yaml", "utf8");
    questions = yaml.load(fileContents) as Question[];
} catch (error) {
    console.error("Error loading questions: ", error);
}

const resultsFile = "results.json";
let results: { taskId: string; category: string; givenAnswer: number; correctAnswer: number }[] = [];
const answeredQuestions: Map<string, number> = new Map();

if (fs.existsSync(resultsFile)) {
    try {
        results = JSON.parse(fs.readFileSync(resultsFile, "utf8"));
        results.forEach(r => answeredQuestions.set(r.taskId, r.givenAnswer));
    } catch (error) {
        console.error("Error loading results: ", error);
    }
}

const saveResults = () => {
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2), "utf8");
};

app.get("/task/:taskId", (req, res) => {
    const { taskId } = req.params;
    const question = questions.find((q) => q.taskId === taskId);
    if (!question) {
        return res.status(404).send("<h1>Frage nicht gefunden</h1>");
    }

    const answered = answeredQuestions.has(taskId);
    const givenAnswer = answered ? answeredQuestions.get(taskId) : null;

    res.send(`
        <html>
            <head>
                <title>Quiz Frage</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; margin: 20px; }
                    .question { font-size: 24px; margin-bottom: 20px; }
                    .category { font-size: 18px; color: gray; margin-bottom: 10px; }
                    .answers button { display: block; margin: 10px auto; padding: 10px; font-size: 18px; }
                    .correct { background-color: green; color: white; }
                    .wrong { background-color: red; color: white; }
                    .disabled { pointer-events: none; opacity: 0.6; }
                </style>
            </head>
            <body>
                <h1>ArV-Quiz</h1>
                <div class="category">Kategorie: ${question.category}</div>
                <div class="question">${question.question}</div>
                <div class="answers">
                    ${question.answers.map((answer, index) => `
                        <button 
                            class="${answered ? (index === question.correctAnswer ? 'correct' : (index === givenAnswer ? 'wrong' : '')) : ''} ${answered ? 'disabled' : ''}"
                            onclick="submitAnswer('${taskId}', ${index})"
                            ${answered ? 'disabled' : ''}
                        >
                            ${answer}
                        </button>
                    `).join('')}
                </div>
                <script>
                    function submitAnswer(taskId, answer) {
                        fetch('/answer', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ taskId, answer })
                        }).then(() => location.reload())
                        .catch(error => console.error("Fehler:", error));
                    }
                </script>
            </body>
        </html>
    `);
});

app.post("/answer", (req, res) => {
    const { taskId, answer } = req.body;
    const question = questions.find((q) => q.taskId === taskId);
    if (!question) {
        return res.status(400).json({ error: "Invalid taskId" });
    }

    if (!answeredQuestions.has(taskId)) {
        results.push({ taskId, category: question.category, givenAnswer: answer, correctAnswer: question.correctAnswer });
        answeredQuestions.set(taskId, answer);
        saveResults();
    }
    res.status(200).send();
});

app.get("/results", (req, res) => {
    res.send(`
        <html>
            <head>
                <title>Quiz Ergebnisse</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; margin: 20px; }
                    table { width: 70%; margin: auto; border-collapse: collapse; }
                    th, td { padding: 10px; border: 1px solid #000; }
                    .correct { color: green; }
                    .wrong { color: red; }
                </style>
            </head>
            <body>
                <h1>Ergebnisse</h1>
                <table>
                    <tr><th>Task ID</th><th>Kategorie</th><th>Angegebene Antwort</th><th>Richtige Antwort</th><th>Korrekt?</th></tr>
                    ${results.length > 0 ? results.map(r => `
                        <tr>
                            <td>${r.taskId}</td>
                            <td>${r.category}</td>
                            <td>${questions.find(q => q.taskId === r.taskId)?.answers[r.givenAnswer]}</td>
                            <td>${questions.find(q => q.taskId === r.taskId)?.answers[r.correctAnswer]}</td>
                            <td class="${r.givenAnswer === r.correctAnswer ? 'correct' : 'wrong'}">${r.givenAnswer === r.correctAnswer ? '✔️' : '❌'}</td>
                        </tr>
                    `).join('') : '<tr><td colspan="5">Noch keine Antworten</td></tr>'}
                </table>
                <button onclick="resetResults()">Reset</button>
                <script>
                    function resetResults() {
                        fetch('/reset', {
                            method: 'POST'
                        }).then(() => location.reload())
                        .catch(error => console.error("Fehler:", error));
                    }
                </script>
            </body>
        </html>
    `);
});

app.post("/reset", (req, res) => {
    results = [];
    answeredQuestions.clear();

    if (fs.existsSync(resultsFile)) {
        fs.unlinkSync(resultsFile);
    }

    res.json({ message: "Ergebnisse zurückgesetzt!" });
});


app.listen(port, () => {
    console.log(`ArV-Quiz server running at http://localhost:${port}`);
});
