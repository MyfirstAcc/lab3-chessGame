const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 4000; 

// Запрос с OPTIONS идет перед основным, поэтому в его заголовках нужно
// указать адрес домена(сервера) с которого можно получить запрос, ну и
// отправить его соотвественно клиенту.
app.use((req, res, next) => {

    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');

    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Magistr-Lesopil');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }

    // Переходим к следующему middleware
    next();
});


/// для получения спрайта фигур
app.post('/data-image', (req, res) => {

    const headerValue = req.header('Magistr-Lesopil'); //извлечение пользовательского заголовка 
    const decodedLastName = b64DecodeUnicode(headerValue);
    //console.log(decodedLastName);
    if (decodedLastName === "303266") { // Проверяем номер зачётки 
        const imagePath = path.join(__dirname, '/chessFigure.png');
        fs.readFile(imagePath, (err, data) => {
            if (err) {
                res.status(500).send('Ошибка чтения изображения!');
            } else {
                res.contentType('image/png'); // Тип контента в зависимости от формата изображения
                res.send(data);
            }
        });
    }
    else {
        res.status(403).json({ message: 'Доступ запрщен!!' });
    }
});

// для получения файла позиционироания фигур
app.post('/data-txt', (req, res) => {

    const headerValue = req.header('Magistr-Lesopil');
    const decodedLastName = b64DecodeUnicode(headerValue);
    //console.log(decodedLastName);
    if (decodedLastName === "303266") { // Проверяем номер зачётки 
        const filePath = path.join(__dirname, '/description.txt');
        res.sendFile(filePath); // Отправляем файл
    }
    else {
        res.status(403).json({ message: 'Доступ запрщен!' });
    }
});

function b64DecodeUnicode(str) {
    return decodeURIComponent(Array.prototype.map.call(Buffer.from(str, 'base64').toString('binary'), function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
}

// Запуск сервера
app.listen(port, () => {
    console.log(`Cross-Origin Server слушает порт: ${port}`);
});