# mini-moda
Biz barcha turdagi bolalar kiyimlarini sotamiz. 
Muammo: Mijozlar do'konga kelishga tanlashga vaqti ko'p ketadi.
Yechim: Sayt orqali 1 daqiqada buyurtma berish

## Buyurtmalarni Telegram'ga yuborish

Sayt Netlify'da joylashtirilganda «Buyurtma berish» oynasidagi forma
`netlify/functions/buyurtma.js` funksiyasi orqali buyurtmani Telegram'ga yuboradi.

Netlify'da **Site configuration → Environment variables** bo'limiga ikkita o'zgaruvchi qo'shing:

| O'zgaruvchi | Qiymati |
|---|---|
| `TELEGRAM_BOT_TOKEN` | @BotFather bergan bot tokeni |
| `TELEGRAM_CHAT_ID` | Buyurtmalar keladigan chat yoki guruh ID raqami |

O'zgaruvchilarni qo'shgandan keyin saytni qayta deploy qiling. Token va chat ID kodga yozilmaydi.
Botga avval o'zingiz (yoki guruhda) bitta xabar yozing, aks holda bot sizga xabar yubora olmaydi.
