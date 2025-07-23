require('dotenv').config();
const { Telegraf, Markup, session } = require('telegraf');
const Database = require('./database');

const bot = new Telegraf(process.env.BOT_TOKEN);
const db = new Database();

// Middleware для сессий
bot.use(session());

// Состояния для машины состояний
const STATES = {
    IDLE: 'idle',
    ADDING_CHANNEL: 'adding_channel',
    CREATING_POST_MESSAGE: 'creating_post_message',
    CREATING_POST_PHOTO: 'creating_post_photo',
    CREATING_POST_SUCCESS: 'creating_post_success',
    CREATING_POST_FAIL: 'creating_post_fail',
    CREATING_POST_BUTTON: 'creating_post_button',
    EDITING_POST_MESSAGE: 'editing_post_message',
    EDITING_POST_PHOTO: 'editing_post_photo',
    EDITING_POST_SUCCESS: 'editing_post_success',
    EDITING_POST_FAIL: 'editing_post_fail',
    EDITING_POST_BUTTON: 'editing_post_button'
};

// Инициализация сессии
bot.use((ctx, next) => {
    if (!ctx.session) {
        ctx.session = {};
    }
    if (!ctx.session.state) {
        ctx.session.state = STATES.IDLE;
    }
    return next();
});

// Команда /start
bot.start(async (ctx) => {
    const startMessage = `
🤖 Добро пожаловать в бота для проверки подписок!

Я помогу вам:
• Управлять каналами и создавать посты с проверкой подписки
• Проверять подписки пользователей
• Администрировать каналы

Выберите действие из меню ниже:
    `;
    
    const mainMenuKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📋 Мои каналы', 'main_my_channels')],
        [Markup.button.callback('➕ Добавить канал', 'main_add_channel')],
        [Markup.button.callback('❓ Помощь', 'main_help')]
    ]);
    
    await ctx.reply(startMessage, mainMenuKeyboard);
});

// Показать меню помощи
const showHelpMenu = async (ctx, editMessage = false) => {
    const helpMessage = `
📖 Справка по использованию

👤 Основные функции:
• Управление каналами
• Создание постов с проверкой подписки
• Проверка подписок пользователей

⚙️ Как это работает:
1. Добавьте бота в ваш канал как администратора
2. Зарегистрируйте канал через "➕ Добавить канал"
3. Создавайте посты с кнопками проверки подписки
4. Пользователи смогут проверить свою подписку

❗ Важно: Бот должен быть администратором канала!
    `;
    
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📋 Мои каналы', 'main_my_channels')],
        [Markup.button.callback('➕ Добавить канал', 'main_add_channel')],
        [Markup.button.callback('🏠 Главное меню', 'main_menu')]
    ]);
    
    if (editMessage) {
        await ctx.editMessageText(helpMessage, keyboard);
    } else {
        await ctx.reply(helpMessage, keyboard);
    }
};

// Команда помощи
bot.command('help', async (ctx) => {
    await showHelpMenu(ctx);
});

// Показать главное меню
const showMainMenu = async (ctx, editMessage = false) => {
    const message = `
🤖 Главное меню

Выберите действие:
    `;
    
    const mainMenuKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📋 Мои каналы', 'main_my_channels')],
        [Markup.button.callback('➕ Добавить канал', 'main_add_channel')],
        [Markup.button.callback('❓ Помощь', 'main_help')]
    ]);
    
    if (editMessage) {
        await ctx.editMessageText(message, mainMenuKeyboard);
    } else {
        await ctx.reply(message, mainMenuKeyboard);
    }
};

// Функция показа превью поста из сессии
const showPostPreview = async (ctx) => {
    try {
        const post = ctx.session.currentPost;
        
        if (!post) {
            await ctx.reply('❌ Нет данных поста для показа');
            return;
        }
        
        const previewMessage = '📋 **Превью поста:**\n\nОбновленная версия:';
        await ctx.reply(previewMessage);
        
        // Показываем пост
        const postKeyboard = Markup.inlineKeyboard([
            [Markup.button.callback(post.buttonText, `check_${post.id}`)]
        ]);
        
        if (post.photoFileId) {
            await ctx.replyWithPhoto(
                post.photoFileId,
                {
                    caption: post.messageText,
                    parse_mode: 'Markdown',
                    reply_markup: postKeyboard.reply_markup
                }
            );
        } else {
            await ctx.reply(
                post.messageText,
                {
                    parse_mode: 'Markdown',
                    ...postKeyboard
                }
            );
        }
        
        // Кнопки для управления постом
        const controlKeyboard = Markup.inlineKeyboard([
            [Markup.button.callback('📤 Переслать в канал', 'publish_current_post')],
            [Markup.button.callback('✏️ Редактировать', 'edit_current_post')],
            [Markup.button.callback('🗑️ Удалить', 'delete_current_post')],
            [Markup.button.callback('📋 Мои каналы', 'my_channels')]
        ]);
        
        await ctx.reply('🎛️ **Управление постом:**', controlKeyboard);
    } catch (error) {
        console.error('Ошибка при показе превью:', error);
        await ctx.reply('❌ Ошибка при показе превью');
    }
};

// Команда для возврата в главное меню
bot.command('menu', async (ctx) => {
    ctx.session.state = STATES.IDLE;
    await showMainMenu(ctx);
});

// Команда для просмотра каналов пользователя
bot.command('mychannels', async (ctx) => {
    await showMyChannels(ctx);
});

// Функция показа каналов пользователя
const showMyChannels = async (ctx, editMessage = false) => {
    try {
        const userId = ctx.from.id.toString();
        const userChannels = await db.getUserChannels(userId);
        
        if (userChannels.length === 0) {
            const message = '📋 У вас пока нет каналов.\n\nДобавьте канал для начала работы.';
            const keyboard = Markup.inlineKeyboard([
                [Markup.button.callback('➕ Добавить канал', 'main_add_channel')],
                [Markup.button.callback('🏠 Главное меню', 'main_menu')]
            ]);
            
            if (editMessage) {
                await ctx.editMessageText(message, keyboard);
            } else {
                await ctx.reply(message, keyboard);
            }
            return;
        }
        
        const keyboard = [
            ...userChannels.map(channel => 
                [Markup.button.callback(`📢 ${channel.channel_name}`, `channel_${channel.channel_id}`)]
            ),
            [
                Markup.button.callback('➕ Добавить канал', 'main_add_channel'),
                Markup.button.callback('🏠 Главное меню', 'main_menu')
            ]
        ];
        
        const message = '📋 Ваши каналы:\n\nВыберите канал для управления:';
        
        if (editMessage) {
            await ctx.editMessageText(message, Markup.inlineKeyboard(keyboard));
        } else {
            await ctx.reply(message, Markup.inlineKeyboard(keyboard));
        }
    } catch (error) {
        console.error('Ошибка при получении каналов:', error);
        await ctx.reply('Произошла ошибка при получении списка каналов.');
    }
};

// Функция начала добавления канала
const startAddingChannel = async (ctx, editMessage = false) => {
    ctx.session.state = STATES.ADDING_CHANNEL;
    
    const botUsername = ctx.botInfo.username;
    
    const message = `
📢 Добавление нового канала

🔸 **Шаг 1:** Добавьте бота в канал как администратора
🔸 **Шаг 2:** Отправьте ID канала или username

📋 **Форматы ID канала:**
• @channelname (для публичных каналов)
• -100xxxxxxxxx (для приватных каналов)

💡 **Как получить ID приватного канала:**
1. Отправьте любое сообщение в канал
2. Перешлите его боту @userinfobot
3. Скопируйте Chat ID

⚡ **Готовы добавить бота?** Используйте кнопку ниже!
    `;
    
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.url('🤖 Добавить бота в канал', `https://t.me/${botUsername}?startchannel&admin=post_messages+edit_messages+delete_messages+restrict_members`)],
        [Markup.button.callback('📝 Ввести ID канала', 'input_channel_id')],
        [Markup.button.callback('❌ Отмена', 'cancel_action')]
    ]);
    
    if (editMessage) {
        await ctx.editMessageText(message, keyboard);
    } else {
        await ctx.reply(message, keyboard);
    }
};

// Команда для добавления канала
bot.command('addchannel', async (ctx) => {
    await startAddingChannel(ctx);
});

// Обработка добавления канала
bot.on('text', async (ctx) => {
    const userId = ctx.from.id.toString();
    
    if (ctx.session.state === STATES.ADDING_CHANNEL) {
        const channelInput = ctx.message.text.trim();
        
        try {
            // Проверяем, является ли пользователь администратором канала
            const chatMember = await ctx.telegram.getChatMember(channelInput, userId);
            
            if (chatMember.status !== 'administrator' && chatMember.status !== 'creator') {
                await ctx.reply('❌ Вы не являетесь администратором этого канала. Сначала добавьте себя как администратора.');
                return;
            }
            
            // Получаем информацию о канале
            const chat = await ctx.telegram.getChat(channelInput);
            
            await db.addChannel(channelInput, chat.title || chat.username);
            await db.addChannelAdmin(channelInput, userId);
            
            ctx.session.state = STATES.IDLE;
            
            const successMessage = `✅ Канал "${chat.title || chat.username}" успешно добавлен!\n\nТеперь вы можете создавать посты с проверкой подписки.`;
            const addChannelKeyboard = Markup.inlineKeyboard([
                [Markup.button.callback('📋 Мои каналы', 'my_channels')],
                [Markup.button.callback('🏠 Главное меню', 'main_menu')]
            ]);
            
            await ctx.reply(successMessage, addChannelKeyboard);
        } catch (error) {
            console.error('Ошибка при добавлении канала:', error);
            
            ctx.session.state = STATES.IDLE;
            
            const botUsername = ctx.botInfo?.username || 'YourBot';
            const errorMessage = `❌ Не удалось добавить канал

🔍 **Возможные причины:**
• ID канала указан неправильно
• Бот не добавлен в канал
• У бота нет прав администратора

💡 **Что делать:**
1. Убедитесь, что бот добавлен в канал
2. Проверьте права администратора
3. Попробуйте еще раз`;
            
            const errorKeyboard = Markup.inlineKeyboard([
                [Markup.button.url('🤖 Добавить бота в канал', `https://t.me/${botUsername}?startchannel&admin=post_messages+edit_messages+delete_messages+restrict_members`)],
                [Markup.button.callback('🔄 Попробовать снова', 'input_channel_id')],
                [Markup.button.callback('🏠 Главное меню', 'main_menu')]
            ]);
            
            await ctx.reply(errorMessage, errorKeyboard);
        }
    } else if (ctx.session.state === STATES.CREATING_POST_MESSAGE) {
        ctx.session.postData.messageText = ctx.message.text;
        ctx.session.state = STATES.CREATING_POST_PHOTO;
        
        const message = '🖼️ Хотите добавить изображение к посту?\n\nОтправьте фото или нажмите "Пропустить":';
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('⏭️ Пропустить', 'skip_photo')],
            [Markup.button.callback('❌ Отмена', 'cancel_action')]
        ]);
        
        await ctx.reply(message, keyboard);
    } else if (ctx.session.state === STATES.CREATING_POST_SUCCESS) {
        // Проверяем длину текста для всплывающего окна
        if (ctx.message.text.length > 190) {
            const message = '⚠️ Текст слишком длинный! Максимум 190 символов.\n\nТекущая длина: ' + ctx.message.text.length + '\n\nВведите более короткий текст:';
            const keyboard = Markup.inlineKeyboard([
                [Markup.button.callback('❌ Отмена', 'cancel_action')]
            ]);
            
            await ctx.reply(message, keyboard);
            return;
        }
        
        ctx.session.postData.successText = ctx.message.text;
        ctx.session.state = STATES.CREATING_POST_FAIL;
        
        const failMessage = `❌ Введите текст для неудачной проверки:

💡 Этот текст увидят пользователи, которые *НЕ подписаны* на канал.`;
        const failKeyboard = Markup.inlineKeyboard([
            [Markup.button.callback('✅ Использовать по умолчанию', 'use_default_fail')],
            [Markup.button.callback('❌ Отмена', 'cancel_action')]
        ]);
        
        await ctx.reply(failMessage, { parse_mode: 'Markdown', ...failKeyboard });
    } else if (ctx.session.state === STATES.CREATING_POST_FAIL) {
        // Проверяем длину текста для всплывающего окна
        if (ctx.message.text.length > 190) {
            const warningMessage = '⚠️ Текст слишком длинный! Максимум 190 символов.\n\nТекущая длина: ' + ctx.message.text.length + '\n\nВведите более короткий текст:';
            const warningKeyboard = Markup.inlineKeyboard([
                [Markup.button.callback('✅ Использовать по умолчанию', 'use_default_fail')],
                [Markup.button.callback('❌ Отмена', 'cancel_action')]
            ]);
            
            await ctx.reply(warningMessage, warningKeyboard);
            return;
        }
        
        ctx.session.postData.failText = ctx.message.text;
        ctx.session.state = STATES.CREATING_POST_BUTTON;
        
        const buttonMessage = '🔘 Введите текст для кнопки проверки (по умолчанию: "Проверить подписку"):';
        const buttonKeyboard = Markup.inlineKeyboard([
            [Markup.button.callback('✅ Использовать по умолчанию', 'use_default_button')],
            [Markup.button.callback('❌ Отмена', 'cancel_action')]
        ]);
        
        await ctx.reply(buttonMessage, buttonKeyboard);
    } else if (ctx.session.state === STATES.EDITING_POST_MESSAGE) {
        // Обновляем данные в сессии
        ctx.session.currentPost.messageText = ctx.message.text;
        
        // Обновляем в базе данных
        try {
            await db.updatePostMessage(ctx.session.currentPost.id, ctx.message.text);
            
            ctx.session.state = STATES.IDLE;
            
            await ctx.reply('✅ Текст сообщения обновлен!');
            await showPostPreview(ctx);
        } catch (error) {
            console.error('Ошибка при обновлении текста сообщения:', error);
            await ctx.reply('❌ Ошибка при обновлении. Попробуйте позже.');
        }
    } else if (ctx.session.state === STATES.EDITING_POST_SUCCESS) {
        
        // Обновляем данные в сессии
        ctx.session.currentPost.successText = ctx.message.text;
        
        // Обновляем в базе данных
        try {
            await db.updatePostSuccessText(ctx.session.currentPost.id, ctx.message.text);
            
            ctx.session.state = STATES.IDLE;
            
            await ctx.reply('✅ Текст успешной проверки обновлен!');
            await showPostPreview(ctx);
        } catch (error) {
            console.error('Ошибка при обновлении текста успеха:', error);
            await ctx.reply('❌ Ошибка при обновлении. Попробуйте позже.');
        }
    } else if (ctx.session.state === STATES.EDITING_POST_FAIL) {
        
        // Обновляем данные в сессии
        ctx.session.currentPost.failText = ctx.message.text;
        
        // Обновляем в базе данных
        try {
            await db.updatePostFailText(ctx.session.currentPost.id, ctx.message.text);
            
            ctx.session.state = STATES.IDLE;
            
            await ctx.reply('✅ Текст неудачной проверки обновлен!');
            await showPostPreview(ctx);
        } catch (error) {
            console.error('Ошибка при обновлении текста неудачи:', error);
            await ctx.reply('❌ Ошибка при обновлении. Попробуйте позже.');
        }
    } else if (ctx.session.state === STATES.EDITING_POST_BUTTON) {
        // Обновляем данные в сессии
        ctx.session.currentPost.buttonText = ctx.message.text;
        
        // Обновляем в базе данных
        try {
            await db.updatePostButtonText(ctx.session.currentPost.id, ctx.message.text);
            
            ctx.session.state = STATES.IDLE;
            
            await ctx.reply('✅ Текст кнопки обновлен!');
            await showPostPreview(ctx);
        } catch (error) {
            console.error('Ошибка при обновлении текста кнопки:', error);
            await ctx.reply('❌ Ошибка при обновлении. Попробуйте позже.');
        }
    } else if (ctx.session.state === STATES.CREATING_POST_BUTTON) {
        const buttonText = ctx.message.text || 'Проверить подписку';
        ctx.session.postData.buttonText = buttonText;
        
        try {
            // Создаем пост в базе данных
            const postId = await db.createPost(
                ctx.session.postData.channelId,
                ctx.session.postData.messageText,
                ctx.session.postData.successText,
                ctx.session.postData.failText || 'Вы не подписаны на канал! Подпишитесь и попробуйте снова.',
                buttonText,
                ctx.session.postData.photoFileId
            );
            

            
            // Показываем превью поста в чате с ботом
            const postKeyboard = Markup.inlineKeyboard([
                [Markup.button.callback(buttonText, `check_${postId}`)]
            ]);
            
            const previewMessage = '📋 **Превью поста:**\n\nВот как будет выглядеть ваш пост. Переслать его в канал?';
            await ctx.reply(previewMessage);
            
            if (ctx.session.postData.photoFileId) {
                // Показываем пост с фото
                await ctx.replyWithPhoto(
                    ctx.session.postData.photoFileId,
                    {
                        caption: ctx.session.postData.messageText,
                        reply_markup: postKeyboard.reply_markup
                    }
                );
            } else {
                // Показываем пост без фото
                await ctx.reply(
                    ctx.session.postData.messageText,
                    postKeyboard
                );
            }
            
            // Сохраняем данные поста в сессии для редактирования
            ctx.session.currentPost = {
                id: postId,
                channelId: ctx.session.postData.channelId,
                messageText: ctx.session.postData.messageText,
                successText: ctx.session.postData.successText,
                failText: ctx.session.postData.failText || 'Вы не подписаны на канал! Подпишитесь и попробуйте снова.',
                buttonText: buttonText,
                photoFileId: ctx.session.postData.photoFileId
            };
            
            // Кнопки для управления постом
            const controlKeyboard = Markup.inlineKeyboard([
                [Markup.button.callback('📤 Переслать в канал', 'publish_current_post')],
                [Markup.button.callback('✏️ Редактировать', 'edit_current_post')],
                [Markup.button.callback('🗑️ Удалить', 'delete_current_post')],
                [Markup.button.callback('📋 Мои каналы', 'my_channels')]
            ]);
            
            ctx.session.state = STATES.IDLE;
            delete ctx.session.postData;
            
            await ctx.reply('🎛️ **Управление постом:**', controlKeyboard);
        } catch (error) {
            console.error('Ошибка при создании поста:', error);
            await ctx.reply('❌ Произошла ошибка при создании поста. Проверьте права бота в канале.');
        }
    }
});

// Обработка фотографий
bot.on('photo', async (ctx) => {
    const userId = ctx.from.id.toString();
    
    if (ctx.session.state === STATES.CREATING_POST_PHOTO) {
        // Получаем file_id самого большого размера фото
        const photo = ctx.message.photo[ctx.message.photo.length - 1];
        ctx.session.postData.photoFileId = photo.file_id;
        
        ctx.session.state = STATES.CREATING_POST_SUCCESS;
        
        const message = `✅ Фото добавлено!

📝 Введите текст для успешной проверки:

💡 Этот текст увидят пользователи, которые *подписаны* на канал.`;
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('❌ Отмена', 'cancel_action')]
        ]);
        
        await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
    } else if (ctx.session.state === STATES.EDITING_POST_PHOTO) {
        try {
            const photo = ctx.message.photo[ctx.message.photo.length - 1];
            
            // Обновляем данные в сессии
            ctx.session.currentPost.photoFileId = photo.file_id;
            
            // Обновляем в базе данных
            await db.updatePostPhoto(ctx.session.currentPost.id, photo.file_id);
            
            ctx.session.state = STATES.IDLE;
            
            await ctx.reply('✅ Изображение обновлено!');
            await showPostPreview(ctx);
        } catch (error) {
            console.error('Ошибка при обновлении изображения:', error);
            await ctx.reply('❌ Ошибка при обновлении. Попробуйте позже.');
        }
    } else {
        await ctx.reply('❓ Отправка фото сейчас недоступна. Используйте меню бота.');
    }
});

// Обработка нажатий на inline кнопки
bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data;
    const userId = ctx.from.id.toString();
    
    // Главное меню
    if (data === 'main_menu') {
        ctx.session.state = STATES.IDLE;
        await ctx.answerCbQuery();
        await showMainMenu(ctx, true);
    } else if (data === 'main_my_channels') {
        await ctx.answerCbQuery();
        await showMyChannels(ctx, true);
    } else if (data === 'main_add_channel') {
        await ctx.answerCbQuery();
        await startAddingChannel(ctx, true);
    } else if (data === 'main_help') {
        await ctx.answerCbQuery();
        await showHelpMenu(ctx, true);
    } else if (data === 'cancel_action') {
        ctx.session.state = STATES.IDLE;
        await ctx.answerCbQuery('Действие отменено');
        await showMainMenu(ctx, true);
    } else if (data === 'input_channel_id') {
        ctx.session.state = STATES.ADDING_CHANNEL;
        
        const message = `
📝 Введите ID или username канала

📋 **Принимаемые форматы:**
• @channelname
• -100xxxxxxxxx

⚠️ **Важно:** Убедитесь, что бот уже добавлен в канал как администратор!
        `;
        
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('�� Назад к добавлению', 'main_add_channel')],
            [Markup.button.callback('❌ Отмена', 'cancel_action')]
        ]);
        
        await ctx.answerCbQuery();
        await ctx.editMessageText(message, keyboard);
    } else if (data === 'my_channels') {
        try {
            const userChannels = await db.getUserChannels(userId);
            
            if (userChannels.length === 0) {
                await ctx.answerCbQuery('У вас нет каналов');
                return;
            }
            
            const keyboard = userChannels.map(channel => 
                [Markup.button.callback(`📢 ${channel.channel_name}`, `channel_${channel.channel_id}`)]
            );
            
            await showMyChannels(ctx, true);
        } catch (error) {
            console.error('Ошибка:', error);
            await ctx.answerCbQuery('Произошла ошибка');
        }
    } else if (data.startsWith('channel_')) {
        const channelId = data.replace('channel_', '');
        
        try {
            // Проверяем права администратора
            const isAdmin = await db.isChannelAdmin(userId, channelId);
            
            if (!isAdmin) {
                await ctx.answerCbQuery('У вас нет прав на управление этим каналом');
                return;
            }
            
            const keyboard = Markup.inlineKeyboard([
                [Markup.button.callback('➕ Создать пост', `create_post_${channelId}`)],
                [Markup.button.callback('⚙️ Настройки канала', `settings_${channelId}`)],
                [Markup.button.callback('🔙 Мои каналы', 'my_channels')],
                [Markup.button.callback('🏠 Главное меню', 'main_menu')]
            ]);
            
            const chat = await ctx.telegram.getChat(channelId);
            
            await ctx.editMessageText(
                `📢 Управление каналом: ${chat.title || chat.username}\n\nВыберите действие:`,
                keyboard
            );
        } catch (error) {
            console.error('Ошибка:', error);
            await ctx.answerCbQuery('Произошла ошибка');
        }
    } else if (data.startsWith('create_post_')) {
        const channelId = data.replace('create_post_', '');
        
        ctx.session.state = STATES.CREATING_POST_MESSAGE;
        ctx.session.postData = { channelId };
        
        await ctx.answerCbQuery();
        
        const message = `📝 Введите текст сообщения для поста:

💡 Этот текст будет показан в канале вместе с кнопкой проверки подписки.`;
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('❌ Отмена', 'cancel_action')]
        ]);
        
        await ctx.reply(message, keyboard);
    } else if (data.startsWith('check_')) {
        const postId = data.replace('check_', '');
        
        try {
            const post = await db.getPost(postId);
            
            if (!post) {
                await ctx.answerCbQuery('Пост не найден');
                return;
            }
            
            // Проверяем подписку пользователя
            const chatMember = await ctx.telegram.getChatMember(post.channel_id, userId);
            
            if (chatMember.status === 'member' || chatMember.status === 'administrator' || chatMember.status === 'creator') {
                // Показываем всплывающее окно с результатом для подписанных
                const successMessage = `✅ Проверка пройдена!\n\n${post.success_text}`;
                await ctx.answerCbQuery(successMessage, true);
            } else {
                // Показываем всплывающее окно с результатом для неподписанных
                const failMessage = `❌ Подписка не найдена\n\n${post.fail_text}`;
                await ctx.answerCbQuery(failMessage, true);
            }
        } catch (error) {
            console.error('Ошибка при проверке подписки:', error);
            await ctx.answerCbQuery('❌ Не удалось проверить подписку. Попробуйте позже.', true);
        }
    } else if (data.startsWith('settings_')) {
        const channelId = data.replace('settings_', '');
        
        try {
            const isAdmin = await db.isChannelAdmin(userId, channelId);
            
            if (!isAdmin) {
                await ctx.answerCbQuery('У вас нет прав на управление этим каналом');
                return;
            }
            
            const chat = await ctx.telegram.getChat(channelId);
            
            const keyboard = Markup.inlineKeyboard([
                [Markup.button.callback('🗑️ Удалить канал', `delete_channel_${channelId}`)],
                [Markup.button.callback('👥 Управление админами', `manage_admins_${channelId}`)],
                [Markup.button.callback('🔙 Назад к каналу', `channel_${channelId}`)],
                [Markup.button.callback('🏠 Главное меню', 'main_menu')]
            ]);
            
            await ctx.answerCbQuery();
            await ctx.editMessageText(
                `⚙️ Настройки канала: ${chat.title || chat.username}\n\nВыберите действие:`,
                keyboard
            );
        } catch (error) {
            console.error('Ошибка:', error);
            await ctx.answerCbQuery('Произошла ошибка');
        }
    } else if (data.startsWith('delete_channel_')) {
        const channelId = data.replace('delete_channel_', '');
        
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('✅ Да, удалить', `confirm_delete_${channelId}`)],
            [Markup.button.callback('❌ Отмена', `settings_${channelId}`)]
        ]);
        
        await ctx.answerCbQuery();
        await ctx.editMessageText(
            '⚠️ Вы действительно хотите удалить канал?\n\nЭто действие нельзя отменить!',
            keyboard
        );
    } else if (data.startsWith('confirm_delete_')) {
        const channelId = data.replace('confirm_delete_', '');
        
        try {
            // Здесь можно добавить логику удаления канала из базы данных
            // Пока просто показываем сообщение
            await ctx.answerCbQuery('Функция удаления будет добавлена в следующем обновлении');
            await showMyChannels(ctx, true);
        } catch (error) {
            console.error('Ошибка:', error);
            await ctx.answerCbQuery('Произошла ошибка');
        }
        } else if (data.startsWith('manage_admins_')) {
        const channelId = data.replace('manage_admins_', '');
        
        await ctx.answerCbQuery();
        await ctx.editMessageText(
            '👥 Управление администраторами\n\nЭта функция находится в разработке.',
            Markup.inlineKeyboard([
                [Markup.button.callback('🔙 Назад к настройкам', `settings_${channelId}`)]
            ])
        );
    } else if (data === 'publish_current_post') {
        const post = ctx.session.currentPost;
        
        if (!post) {
            await ctx.answerCbQuery('Нет данных поста для публикации');
            return;
        }
        
        try {
            // Проверяем права администратора
            const isAdmin = await db.isChannelAdmin(userId, post.channelId);
            
            if (!isAdmin) {
                await ctx.answerCbQuery('У вас нет прав на публикацию в этом канале');
                return;
            }
            
            // Отправляем пост в канал
            const publishKeyboard = Markup.inlineKeyboard([
                [Markup.button.callback(post.buttonText, `check_${post.id}`)]
            ]);
            
            let sentMessage;
            if (post.photoFileId) {
                // Отправляем пост с фото
                sentMessage = await ctx.telegram.sendPhoto(
                    post.channelId,
                    post.photoFileId,
                    {
                        caption: post.messageText,
                        parse_mode: 'Markdown',
                        reply_markup: publishKeyboard.reply_markup
                    }
                );
            } else {
                // Отправляем пост без фото
                sentMessage = await ctx.telegram.sendMessage(
                    post.channelId,
                    post.messageText,
                    {
                        parse_mode: 'Markdown',
                        ...publishKeyboard
                    }
                );
            }
            
            // Сохраняем ID сообщения
            await db.updatePostMessageId(post.id, sentMessage.message_id);
            
            await ctx.answerCbQuery('✅ Пост опубликован в канале!');
            
            const successMessage = '✅ Пост успешно опубликован в канале!';
            const successKeyboard = Markup.inlineKeyboard([
                [Markup.button.callback('📋 Мои каналы', 'my_channels')],
                [Markup.button.callback('🏠 Главное меню', 'main_menu')]
            ]);
            
            await ctx.editMessageText(successMessage, successKeyboard);
        } catch (error) {
            console.error('Ошибка при публикации поста:', error);
            await ctx.answerCbQuery('❌ Ошибка при публикации поста');
        }
    } else if (data === 'delete_current_post') {
        const confirmKeyboard = Markup.inlineKeyboard([
            [Markup.button.callback('✅ Да, удалить', 'confirm_delete_current_post')],
            [Markup.button.callback('❌ Отмена', 'back_to_post')]
        ]);
        
        await ctx.answerCbQuery();
        await ctx.editMessageText(
            '⚠️ Вы действительно хотите удалить этот пост?\n\nОтменить это действие будет невозможно.',
            confirmKeyboard
        );
    } else if (data === 'confirm_delete_current_post') {
        try {
            // Здесь можно добавить функцию удаления поста из базы данных
            delete ctx.session.currentPost;
            
            await ctx.answerCbQuery('Пост удален из черновиков');
            await showMyChannels(ctx, true);
        } catch (error) {
            console.error('Ошибка при удалении поста:', error);
            await ctx.answerCbQuery('Ошибка при удалении');
        }
    } else if (data === 'edit_current_post') {
        const post = ctx.session.currentPost;
        
        if (!post) {
            await ctx.answerCbQuery('Нет данных поста для редактирования');
            return;
        }
        
        // Проверяем права администратора
        const isAdmin = await db.isChannelAdmin(userId, post.channelId);
        
        if (!isAdmin) {
            await ctx.answerCbQuery('У вас нет прав на редактирование этого поста');
            return;
        }
        
        const editMessage = `✏️ **Редактирование поста**
        
📝 **Текущий текст:** ${post.messageText.substring(0, 100)}${post.messageText.length > 100 ? '...' : ''}
🖼️ **Изображение:** ${post.photoFileId ? 'Есть' : 'Нет'}
✅ **Текст успеха:** ${post.successText.substring(0, 50)}...
❌ **Текст неудачи:** ${post.failText ? post.failText.substring(0, 50) : 'Не задан'}...
🔘 **Кнопка:** ${post.buttonText}

Что хотите изменить?`;
        
        const editKeyboard = Markup.inlineKeyboard([
            [Markup.button.callback('📝 Изменить текст', 'edit_message')],
            [
                Markup.button.callback('🖼️ Изменить фото', 'edit_photo'),
                Markup.button.callback('🗑️ Удалить фото', 'remove_photo')
            ],
            [Markup.button.callback('✅ Текст успеха', 'edit_success')],
            [Markup.button.callback('❌ Текст неудачи', 'edit_fail')],
            [Markup.button.callback('🔘 Текст кнопки', 'edit_button')],
            [Markup.button.callback('🔙 Назад к посту', 'back_to_post')]
        ]);
        
        await ctx.answerCbQuery();
        await ctx.editMessageText(editMessage, editKeyboard);
    } else if (data === 'edit_message') {
        ctx.session.state = STATES.EDITING_POST_MESSAGE;
        
        const message = `📝 Введите новый текст для поста:

💡 Этот текст будет показан в канале вместе с кнопкой проверки подписки.`;
        
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('❌ Отмена', 'cancel_editing')]
        ]);
        
        await ctx.answerCbQuery();
        await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
    } else if (data === 'edit_photo') {
        ctx.session.state = STATES.EDITING_POST_PHOTO;
        
        const message = '🖼️ Отправьте новое изображение для поста:';
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('❌ Отмена', 'cancel_editing')]
        ]);
        
        await ctx.answerCbQuery();
        await ctx.editMessageText(message, keyboard);
    } else if (data === 'remove_photo') {
        try {
            // Обновляем данные в сессии
            ctx.session.currentPost.photoFileId = null;
            
            // Обновляем в базе данных
            await db.removePostPhoto(ctx.session.currentPost.id);
            
            await ctx.answerCbQuery('✅ Изображение удалено!');
            await showPostPreview(ctx);
        } catch (error) {
            console.error('Ошибка при удалении изображения:', error);
            await ctx.answerCbQuery('❌ Ошибка при удалении изображения');
        }
    } else if (data === 'edit_success') {
        ctx.session.state = STATES.EDITING_POST_SUCCESS;
        
        const message = `✅ Введите новый текст для успешной проверки:

💡 Этот текст увидят пользователи, которые <b>подписаны</b> на канал.`;
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('❌ Отмена', 'cancel_editing')]
        ]);
        
        await ctx.answerCbQuery();
        await ctx.editMessageText(message, keyboard);
    } else if (data === 'edit_fail') {
        ctx.session.state = STATES.EDITING_POST_FAIL;
        
        const message = `❌ Введите новый текст для неудачной проверки:

💡 Этот текст увидят пользователи, которые <b>НЕ подписаны</b> на канал.`;
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('❌ Отмена', 'cancel_editing')]
        ]);
        
        await ctx.answerCbQuery();
        await ctx.editMessageText(message, keyboard);
    } else if (data === 'edit_button') {
        ctx.session.state = STATES.EDITING_POST_BUTTON;
        
        const message = '🔘 Введите новый текст для кнопки проверки:';
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('❌ Отмена', 'cancel_editing')]
        ]);
        
        await ctx.answerCbQuery();
        await ctx.editMessageText(message, keyboard);
    } else if (data === 'back_to_post') {
        await ctx.answerCbQuery();
        await showPostPreview(ctx);
    } else if (data === 'cancel_editing') {
        ctx.session.state = STATES.IDLE;
        
        await ctx.answerCbQuery('Редактирование отменено');
        await showMainMenu(ctx, true);
    } else if (data === 'use_default_button') {
         if (ctx.session.state === STATES.CREATING_POST_BUTTON && ctx.session.postData) {
             const buttonText = 'Проверить подписку';
             ctx.session.postData.buttonText = buttonText;
             
             try {
                 // Создаем пост в базе данных
                 const postId = await db.createPost(
                     ctx.session.postData.channelId,
                     ctx.session.postData.messageText,
                     ctx.session.postData.successText,
                     ctx.session.postData.failText || 'Вы не подписаны на канал! Подпишитесь и попробуйте снова.',
                     buttonText,
                     ctx.session.postData.photoFileId
                 );
                 

                 
                 // Показываем превью поста в чате с ботом
                 const defaultPostKeyboard = Markup.inlineKeyboard([
                     [Markup.button.callback(buttonText, `check_${postId}`)]
                 ]);
                 
                 await ctx.answerCbQuery('Пост создан с кнопкой по умолчанию!');
                 
                 const previewMessage = '📋 **Превью поста:**\n\nВот как будет выглядеть ваш пост. Переслать его в канал?';
                 await ctx.editMessageText(previewMessage);
                 
                 if (ctx.session.postData.photoFileId) {
                     // Показываем пост с фото
                     await ctx.replyWithPhoto(
                         ctx.session.postData.photoFileId,
                         {
                             caption: ctx.session.postData.messageText,
                             reply_markup: defaultPostKeyboard.reply_markup
                         }
                     );
                 } else {
                     // Показываем пост без фото
                     await ctx.reply(
                         ctx.session.postData.messageText,
                         defaultPostKeyboard
                     );
                 }
                 
                 // Сохраняем данные поста в сессии для редактирования
                 ctx.session.currentPost = {
                     id: postId,
                     channelId: ctx.session.postData.channelId,
                     messageText: ctx.session.postData.messageText,
                     successText: ctx.session.postData.successText,
                     failText: ctx.session.postData.failText || 'Вы не подписаны на канал! Подпишитесь и попробуйте снова.',
                     buttonText: buttonText,
                     photoFileId: ctx.session.postData.photoFileId
                 };
                 
                 // Кнопки для управления постом
                 const controlKeyboard = Markup.inlineKeyboard([
                     [Markup.button.callback('📤 Переслать в канал', 'publish_current_post')],
                     [Markup.button.callback('✏️ Редактировать', 'edit_current_post')],
                     [Markup.button.callback('🗑️ Удалить', 'delete_current_post')],
                     [Markup.button.callback('📋 Мои каналы', 'my_channels')]
                 ]);
                 
                 ctx.session.state = STATES.IDLE;
                 delete ctx.session.postData;
                 
                 await ctx.reply('🎛️ **Управление постом:**', controlKeyboard);
             } catch (error) {
                 console.error('Ошибка при создании поста:', error);
                 await ctx.answerCbQuery('Произошла ошибка при создании поста');
             }
         } else {
             await ctx.answerCbQuery('Неверное состояние');
         }
     } else if (data === 'skip_photo') {
         if (ctx.session.state === STATES.CREATING_POST_PHOTO && ctx.session.postData) {
                           ctx.session.state = STATES.CREATING_POST_SUCCESS;
              
              const message = '📝 Введите текст для успешной проверки:\n\n💡 Этот текст появится во всплывающем окне при успешной проверке подписки.\n\n⚠️ Максимум 190 символов.';
              const keyboard = Markup.inlineKeyboard([
                  [Markup.button.callback('❌ Отмена', 'cancel_action')]
              ]);
             
             await ctx.answerCbQuery('Фото пропущено');
             await ctx.editMessageText(message, keyboard);
         } else {
             await ctx.answerCbQuery('Неверное состояние');
         }
     }
});

// Обработка ошибок
bot.catch((err, ctx) => {
    console.error('Ошибка бота:', err);
    console.error('Контекст:', ctx);
});

// Запуск бота
bot.launch()
    .then(async () => {
        // Получаем информацию о боте для формирования ссылок
        const botInfo = await bot.telegram.getMe();
        bot.botInfo = botInfo;
        
        console.log('🤖 Бот запущен успешно!');
        console.log(`📋 Username бота: @${botInfo.username}`);
        console.log('💾 База данных готова к работе');
    })
    .catch(err => {
        console.error('Ошибка запуска бота:', err);
    });

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM')); 