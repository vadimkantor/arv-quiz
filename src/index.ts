import * as express from "express";
import * as yaml from "js-yaml";
import * as fs from "fs";
import * as cors from "cors";

interface Question {
    category: string;
    taskId: string;
    question: string;
    answers: string[];
    correctAnswer: number;
}

const app = express();
const port = 3000;
app.use(express.json());
app.use(cors());

// Load questions from YAML file
let questions: Question[] = [];
try {
    const fileContents = fs.readFileSync("questions.yaml", "utf8");
    console.log("Loaded questions:", questions);
    questions = yaml.load(fileContents) as Question[];
} catch (error) {
    console.error("Error loading questions: ", error);
}

const resultsFile = "results.json";
let results: { taskId: string; question: string; givenAnswer: string; correctAnswer: string; correct: boolean }[] = [];
const answeredQuestions: Set<string> = new Set();

// Load previous results if they exist
if (fs.existsSync(resultsFile)) {
    try {
        results = JSON.parse(fs.readFileSync(resultsFile, "utf8"));
        results.forEach(r => answeredQuestions.add(r.taskId));
    } catch (error) {
        console.error("Error loading results: ", error);
    }
}

// Save results to file
const saveResults = () => {
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2), "utf8");
};

// Serve HTML page for a specific question
app.get("/task/:taskId", (req, res) => {
    const { taskId } = req.params;
    const question = questions.find((q) => q.taskId === taskId);
    if (!question) {
        return res.status(404).send("<h1>Frage nicht gefunden</h1>");
    }

    const alreadyAnswered = answeredQuestions.has(taskId);

    res.send(`
        <html>
            <head>
                <title>Quiz Frage</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; margin: 20px; }
                    .question { font-size: 24px; margin-bottom: 20px; }
                    table { width: 50%; margin: auto; border-collapse: collapse; }
                    th, td { padding: 10px; border: 1px solid #000; }
                </style>
            </head>
            <body>
                <h1>ArV-Quiz</h1>
                <table>
                    <tr><th>Task ID</th><td>${question.taskId}</td></tr>
                    <tr><th>Kategorie</th><td>${question.category}</td></tr>
                    <tr><th>Frage</th><td>${question.question}</td></tr>
                </table>
                <h2>Antworten</h2>
                <table>
                    ${question.answers.map((answer, index) => `
                        <tr><td><button onclick="submitAnswer('${taskId}', ${index})">${answer}</button></td></tr>
                    `).join('')}
                </table>
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

// Endpoint to submit an answer
app.post("/answer", (req, res) => {
    const { taskId, answer } = req.body;
    const question = questions.find((q) => q.taskId === taskId);
    if (!question) {
        return res.status(400).json({ error: "Invalid taskId" });
    }
    const correct = question.correctAnswer === answer;
    if (!answeredQuestions.has(taskId)) {
        results.push({
            taskId,
            question: question.question,
            givenAnswer: question.answers[answer],
            correctAnswer: question.answers[question.correctAnswer],
            correct
        });
        answeredQuestions.add(taskId);
        saveResults();
    }
    res.status(200).send();
});

// Endpoint to reset results
app.post("/reset", (req, res) => {
    results = [];
    answeredQuestions.clear();
    fs.unlinkSync(resultsFile);
    res.json({ message: "Ergebnisse zurückgesetzt!" });
});

// Endpoint to get results
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
                    <tr><th>Task ID</th><th>Frage</th><th>Angegebene Antwort</th><th>Richtige Antwort</th><th>Korrekt?</th></tr>
                    ${results.length > 0 ? results.map(r => `
                        <tr>
                            <td>${r.taskId}</td>
                            <td>${r.question}</td>
                            <td>${r.givenAnswer}</td>
                            <td>${r.correctAnswer}</td>
                            <td class="${r.correct ? 'correct' : 'wrong'}">${r.correct ? '✔️' : '❌'}</td>
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

app.listen(port, () => {
    console.log(`ArV-Quiz server running at http://localhost:${port}`);
});
