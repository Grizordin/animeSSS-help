// Resolves the actual notification catalogue. No site requests or notifications sent.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '..', 'AnimeSSS_help.user.js'), 'utf8');
new vm.Script(source);
const start = source.indexOf('  const CPT_ICO = {');
const end = source.indexOf('  const CPT_UNKNOWN_SENT_KEY');
assert.ok(start > 0 && end > start);
const context = vm.createContext({});
vm.runInContext(source.slice(start, end) + '\nthis.catalogue = CPT_MAP; this.icons = CPT_ICO; this.themes = CPT_CLS;', context);
const messages = [
  ['Не удалось получить ответ сервера. Обновите страницу и проверьте награду перед повтором.', 'Награда', 'neon-amber'],
  ['За сбор полной коллекции карточек вы получили высшую награду: 13500 камней духа', 'Коллекция', 'neon-green'],
  ['Прогресс испытания обновлён.', 'Испытание', 'neon-blue'],
  ['Условие испытания выполнено. Его можно завершить.', 'Испытание', 'neon-green'],
  ['Для того чтобы оставить своё мнение об аниме вы должны его посмотреть', 'Аниме', 'neon-amber'],
  ['Выбор судьбы не найден', 'Комната', 'neon-amber'],
  ['Испытание успешно завершено.', 'Испытание', 'neon-green'],
  ['Активная головоломка не найдена', 'Головоломка', 'neon-amber'],
  ['Новое испытание успешно открыто.', 'Испытание', 'neon-green'],
  ['Вы получили 500 опыта уровня.', 'Опыт', 'neon-green'],
  ['Данное аниме уже есть в этом списке', 'Список', 'neon-amber'],
  ['Блокировка карты снята.', 'Разблокировка', 'emerald'],
  ['Вы использовали дневной лимит в 5 плавок карт ранга А', 'Переплавка', 'rose'],
  ['Для продолжения необходимо авторизоваться.', 'Авторизация', 'rose'],
  ['Такой карты нет в наличии.', 'Карта', 'neon-amber'],
  ['Активный алтарь удачи не найден', 'Алтарь', 'neon-amber'],
  ['В этой комнате нельзя установить личного стража', 'Комната', 'neon-amber'],
  ['Активная ловушка не найдена', 'Ловушка', 'neon-amber'],
  ['При сдаче набора произошла ошибка.', 'Коллекция', 'rose'],
  ['Ввод промо-кода отключён с 21:00 до 21:10', 'Промокод', 'neon-amber'],
  ['Слишком много картинок/смайлов в сообщении', 'Сообщения', 'neon-amber'],
  ['У вас нет свободного экземпляра карты для подношения.', 'Подношение', 'neon-amber'],
  ['Не удалось загрузить изображение в предпросмотр', 'Изображение', 'rose'],
  ['Не хватает очков вклада', 'Клуб', 'neon-amber'],
  ['Одна из карт которую вы предложили на обмен больше не пренадлежит вам', 'Обмен', 'rose'],
  ['Не удалось получить ответ сервера. Повторите загрузку паков.', 'Паки', 'neon-amber'],
  ['В витрину можно выставить максимум три пробужденные карты SSS', 'Витрина', 'neon-amber']
];
if (process.argv.includes('--audit')) {
  const existing = messages.filter(([text]) => context.cptResolve(text));
  console.log(JSON.stringify({ total: messages.length, existing: existing.length, missing: messages.filter(([text]) => !context.cptResolve(text)).map(([text]) => text) }));
  process.exit(0);
}
let passed = 0;
function check(value, label) { assert.ok(value, label); passed++; }
const variants = [
  ['За сбор полной коллекции карточек вы получили высшую награду: 27 000 камней духа.', 'Коллекция', 'neon-green'],
  ['За сбор полной коллекции карточек вы получили высшую награду: 13\u00a0500 камней духа', 'Коллекция', 'neon-green'],
  ['Прогресс испытания обновлен.', 'Испытание', 'neon-blue'],
  ['Для того чтобы оставить свое мнение об аниме вы должны его посмотреть', 'Аниме', 'neon-amber'],
  ['Вы использовали дневной лимит в 10 плавок карт ранга A', 'Переплавка', 'rose'],
  ['Вы использовали дневной лимит в 3 плавки карт ранга B.', 'Переплавка', 'rose'],
  ['Ввод промо-кода отключен с 9:05 до 9:15.', 'Промокод', 'neon-amber'],
  ['Одна из карт, которую вы предложили на обмен, больше не принадлежит вам.', 'Обмен', 'rose'],
  ['Одна карта из предложенных вами вам больше не принадлежит', 'Обмен', 'rose'],
  ['Вы получили 1 000 опыта аккаунта.', 'Опыт', 'neon-green'],
  ['В витрину можно выставить максимум три пробуждённые карты SSS', 'Витрина', 'neon-amber']
];
for (const [text, title, theme] of [...messages, ...variants]) {
  const result = context.cptResolve(text);
  const matches = context.catalogue.filter(row => row.r ? row.r.test(text) : text.toLowerCase().includes(row.s.toLowerCase()));
  check(matches.length === 1, 'exactly one matching rule: ' + text);
  check(result?.title === title && result?.theme === theme, 'correct category and severity: ' + text);
  check(!!context.icons[result.icon] && !!context.themes[result.theme], 'existing icon and theme: ' + text);
}
const keys = context.catalogue.map(row => row.r ? 'r:' + row.r : 's:' + row.s.toLowerCase());
check(new Set(keys).size === keys.length, 'no duplicate catalogue rules');
for (const text of ['Не удалось получить ответ сервера. Неизвестная операция.', 'Вы получили неизвестную награду.', 'Испытание не выполнено.', 'Ввод промо-кода включён с 21:00 до 21:10']) {
  check(context.cptResolve(text) === null, 'unrelated text not misclassified: ' + text);
}
console.log(JSON.stringify({ result: 'CUSTOM_PUSH_MESSAGES_OK', messages: messages.length, variants: variants.length, passed }));
