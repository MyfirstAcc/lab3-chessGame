document.addEventListener('DOMContentLoaded', () => {
    //создание экземпляра класса с вызовом пользовательского конструктора. Последний параметр - номер зачётки
    const chessGame = new ChessGame('chessBoard', 'http://localhost:4000', '303266'); 
    chessGame.run(); //запуск запросов, отрисовки доски, создание событий  
});


class ChessGame {
    constructor(canvasId, serverUrl, acceeptData) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.serverUrl = serverUrl; // Адрес сервера (Cross-Origin). Должен быть запущен вместе с основным
        this.tileSize = 100; // Размер клетки
        this.boardSize = 8;  // Размер доски
        this.piecesImage = null;   // Изображение
        this.selectedPiece = null; // Спрайты

        this.isBouncing = false;
        this.bounceHeight = 0;
        this.bounceDirection = 1; // 1 - вверх, -1 - вниз
        this.maxBounceHeight = 25; // Максимальная высота прыжка
        this.acceeptData = acceeptData; // Авторизация на сервре 
        this.board = Array.from({ length: this.boardSize }, () => Array(this.boardSize).fill(null)); // Шахматное поле в виде матрицы
        this.spriteData = []; // Приходящие спрайты
        this.initialDrawDone = false; // Флаг для отслеживания первой отрисовки


    }

    async run() {
        await this.fetchImage(); // Сначала выполняем основной запрос, внутри вызвается resolve()
        await this.fetchTXT(); // Затем выполняем второй запрос
    }

    // Разбивка строк для получения координат на доске
    //%Sprite_king/0/2/300/330/black% 
    parseGraphicsDescription(fileContent) {
        const lines = fileContent.split(/\r?\n/);
    
        const spriteRegex = /%Sprite_(\w+)\/(\d+)\/(\d+)\/(\d+)\/(\d+)\/(\w+)%/g; 

        this.spriteData = []; 
        lines.forEach(line => {
            let match;
            while ((match = spriteRegex.exec(line)) !== null) {
                const [, type, row, col, width, height, command] = match;
                this.spriteData.push({
                    type,
                    row: parseInt(row, 10),
                    col: parseInt(col, 10),
                    width: parseInt(width, 10),
                    height: parseInt(height, 10),
                    command
                });
            }
        });
    }


    // Первый метод для выполнения запроса, взятие картинки с фигурами
    async fetchImage() {
        const encodedLastName = this.b64EncodeUnicode(this.acceeptData); // Кодируем в base64 для передачи в заголовке
        try {
            const response = await fetch(`${this.serverUrl}/data-image`, {
                method: 'POST',
                headers: {
                    'Magistr-Lesopil': encodedLastName //пользовательский заголовок для авторизации
                }
            });

            if (response.ok) {
                const imageBlob = await response.blob();
                const imageUrl = URL.createObjectURL(imageBlob);
                this.piecesImage = new Image();
                this.piecesImage.src = imageUrl;

                return new Promise((resolve) => {
                    this.piecesImage.onload = () => {
                        resolve(); // Сообщаем, что изображение загружено
                    };
                });
            } else {
                console.error('Ошибка при запросе:', response.statusText);
            }
        } catch (error) {
            console.error('Ошибка при запросе:', error);
        }
    }

    // Второй метод для выполнения дополнительного запроса, взятия файла с координатами 
    async fetchTXT() {
        const encodedLastName = this.b64EncodeUnicode(this.acceeptData); // Кодируем в base64
        try {
            const response = await fetch(`${this.serverUrl}/data-txt`, {
                method: 'POST',
                headers: {
                    'Magistr-Lesopil': encodedLastName
                }
            });

            if (response.ok) {
                const text = await response.text(); // Получаем содержимое текстового файла
                console.log('Полученный текст:', text);
                this.parseGraphicsDescription(text); //разбиение полученого файла
                this.fillBoardWithPieces(); // заполнение фигур по клеткам
                this.gameLoop(); // Запуск основного цикла отрисовки после загрузки данных
                this.addEventListeners(); // Добавление обработчиков событий

            } else {
                console.error('Ошибка при запросе:', response.statusText);
            }
        } catch (error) {
            console.error('Ошибка при запросе:', error);
        }
    }

    b64EncodeUnicode(str) {
        return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (match, p1) {
            return String.fromCharCode('0x' + p1);
        }));
    }


    createPiece(type, color, width, height) {
        return {
            type: type,
            color: color,
            width: width,
            height: height
        };
    }

    // Отрисовка доски
    drawBoard() {
        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                const isDarkTile = (row + col) % 2 === 1;
                this.ctx.fillStyle = isDarkTile ? '#B58863' : '#F0D9B5'; //цвет клеток
                this.ctx.fillRect(col * this.tileSize, row * this.tileSize, this.tileSize, this.tileSize);
            }
        }
    }

    fillBoardWithPieces() {
        // Очистка доски
        this.board = Array.from({ length: this.boardSize }, () => Array(this.boardSize).fill(null));

        this.spriteData.forEach(sprite => {
            // Определение цвета фигуры
            const color = sprite.command; 

            // Создание фигуры
            const piece = this.createPiece(sprite.type, color, sprite.width, sprite.height);

            // Установка фигуры на доску
            if (sprite.row >= 0 && sprite.row < this.boardSize && sprite.col >= 0 && sprite.col < this.boardSize) {
                this.board[sprite.row][sprite.col] = piece;
            }
        });
    }


    // Цикл отрисовки доски и фигур
    gameLoop = () => {
        this.drawBoard();
        this.drawPieces();
        this.animateBounce();
        requestAnimationFrame(this.gameLoop); //обновление экрана 
    }


    // Метод добавления обработчика событий
    addEventListeners() {
        this.canvas.addEventListener('click', (event) => {
            const x = event.offsetX;
            const y = event.offsetY;
            // Вычисляем номер клетки
            const col = Math.floor(x / this.tileSize);
            const row = Math.floor(y / this.tileSize);

            if (this.selectedPiece) {
                // Перемещение фигур
                this.movePiece(this.selectedPiece, row, col);
                this.selectedPiece = null;
                this.drawBoard(); // Перерисовка доски

            } else {
                // Выбор фигуры
                this.selectedPiece = this.getPieceAt(row, col);
                if (this.selectedPiece) {
                    this.isBouncing = true; // Запуск анимации прыжка
                    this.bounceDirection = 1; // Начинаем прыгать вверх
                    this.animateBounce(); // Анимация начинается
                }
            }
            // console.log(this.board);
        });
    }


    // Нахождение фигуры на доске
    getPieceAt(row, col) {
        if (row >= 0 && row < 8 && col >= 0 && col < 8) {
            return this.board[row][col];
        }
        return null;
    }

    // Перемещение фигуры на доске
    movePiece(piece, newRow, newCol) {
        if (piece && newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
            const targetPiece = this.getPieceAt(newRow, newCol);

            // Проверка на то, что клетка назначения пуста или содержит фигуру другого цвета
            if (targetPiece === null || targetPiece.color !== piece.color) {
                // Находим текущую позицию фигуры на доске
                for (let row = 0; row < 8; row++) {
                    for (let col = 0; col < 8; col++) {
                        if (this.board[row][col] === piece) {
                            this.board[row][col] = null; // Удаляем фигуру с её текущей позиции
                            break; // Прерываем цикл после нахождения фигуры
                        }
                    }
                }

                // Устанавливаем фигуру на новую позицию
                this.board[newRow][newCol] = piece;
            }
        }
    }


    animateBounce() {
        if (this.isBouncing) {
            // Изменяем высоту прыжка
            this.bounceHeight += this.bounceDirection * 1; // Скорость прыжка

            // Если достигнута максимальная высота или фигура вернулась на исходную позицию
            if (this.bounceHeight >= this.maxBounceHeight || this.bounceHeight <= 0) {
                this.bounceDirection *= -1; // Меняем направление прыжка

                // Если фигура вернулась на доску, останавливаем прыжок
                if (this.bounceHeight <= 0) {
                    this.isBouncing = false;
                    this.bounceHeight = 0;
                }
            }
        }
    }


    drawPieces() {
        if (!this.piecesImage) {
            return; // Если изображение еще не загружено, не рисуем фигуры
        }

        // Загрузка из файла осуществляется только первый раз, далее игровое поле
        // рисуется на основе массива board
        if (!this.initialDrawDone) {
            // Отрисовка фигуры на основе данных спрайтов
            this.spriteData.forEach(sprite => {
                const x = sprite.col * this.tileSize;
                const y = sprite.row * this.tileSize;
                const spriteX = this.getSpriteX(sprite.type);
                const spriteY = this.getSpriteY(sprite.command);

                this.ctx.drawImage(
                    this.piecesImage,
                    spriteX, spriteY, sprite.width, sprite.height, // Источник спрайта
                    x, y, this.tileSize, this.tileSize // Отрисовка на канве
                );
            });
            this.initialDrawDone = true; // Устанавливаем флаг, что фигуры из файла считаны
        } else {
            // Перерисовка фигур на основе массива board
            for (let rowIndex = 0; rowIndex < this.boardSize; rowIndex++) {
                for (let colIndex = 0; colIndex < this.boardSize; colIndex++) {
                    const piece = this.getPieceAt(rowIndex, colIndex);
                    if (piece) {
                        let x = colIndex * this.tileSize;
                        let y = rowIndex * this.tileSize;

                        if (this.selectedPiece === piece && this.isBouncing) {
                            y -= this.bounceHeight;
                        }
                        const spriteX = this.getSpriteX(piece.type);
                        const spriteY = this.getSpriteY(piece.color);

                        this.ctx.drawImage(
                            this.piecesImage,
                            spriteX, spriteY, piece.width, piece.height, // Источник спрайта
                            x, y, this.tileSize, this.tileSize // Отрисовка на канве
                        );
                    }
                }
            }
        }
    }


    getSpriteX(type) {
        // Определяем координаты X спрайта на изображении в зависимости от типа фигуры
        switch (type) {
            case 'king':
                return 0;
            case 'queen':
                return 350;
            case 'bishop':
                return 680;
            case 'knight':
                return 1010;
            case 'rook':
                return 1345;
            case 'pawn':
                return 1665;
            default:
                return 0;
        }
    }

    getSpriteY(type) {
        // Определяем координаты Y спрайта на изображении в зависимости от типа фигуры
        return type === 'white' ? 0 : 330; // Черные фигуры начинаются с 330
    }
}

