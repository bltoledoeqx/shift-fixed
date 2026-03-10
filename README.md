# 🚀 Shift Navigator

Sistema de gestão de escalas para operações 24/7.

## Stack
- **Frontend:** React + TypeScript + Vite + shadcn/ui + Tailwind CSS
- **Backend:** Node.js + Express + SQLite (better-sqlite3)
- **Notificações:** Telegram Bot (cron a cada minuto)
- **Container:** Docker / Docker Compose

---

## ▶️ Rodar com Docker (Recomendado)

```bash
# Build e start na porta 3000
docker-compose up -d --build

# Acessar: http://localhost:3000
```

Para parar:
```bash
docker-compose down
```

Os dados ficam persistidos no volume Docker `shift_data`.

---

## 🛠️ Desenvolvimento Local

### Backend
```bash
cd backend
npm install
PORT=3001 node server.js
```

### Frontend
```bash
cd frontend
npm install
npm run dev     # Disponível em http://localhost:5173
```

> O frontend já está configurado para fazer proxy de `/api` para `http://localhost:3001`.

---

## 📱 Configuração Telegram

1. Acesse `/configuracoes` na aplicação
2. Aba **Sistema**
3. Insira o token do bot (já pré-configurado)
4. Para cada analista, cadastre o **Telegram Chat ID** dele em `/configuracoes > Membros > Editar`
5. O analista pode obter seu Chat ID enviando uma mensagem para [@userinfobot](https://t.me/userinfobot) no Telegram

---

## 📂 Páginas

| Rota | Descrição |
|---|---|
| `/` | Painel — Turno Regular (seg-sex) ou Plantão FDS |
| `/escala` | Escala semanal por equipe |
| `/sobreaviso` | Grade de sobreaviso semanal |
| `/equipe` | Cards da equipe + Setor de Escalation |
| `/configuracoes` | Admin: membros, escalas, sobreaviso, sistema |

---

## 🗃️ Banco de Dados

SQLite persistido em `/app/data/shift_navigator.db` (no container).
Dados são populados automaticamente no primeiro start.
