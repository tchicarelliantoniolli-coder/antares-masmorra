// Servidor HTTP do jogo.
// Etapa 1: serve os arquivos do cliente (Phaser), o código compartilhado e os dados JSON.
// Etapa 2: este mesmo servidor vai rodar o Socket.io e a simulação autoritativa das salas online.
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = express();

app.use(express.static(path.join(root, 'client')));
app.use('/shared', express.static(path.join(root, 'shared')));
app.use('/vendor', express.static(path.join(root, 'node_modules/phaser/dist')));
app.use('/fonts', express.static(path.join(root, 'node_modules/@fontsource/press-start-2p/files')));
app.use('/fonts', express.static(path.join(root, 'node_modules/@fontsource/vt323/files')));

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`\n  Antares: A Masmorra Escolar`);
  console.log(`  Abra no navegador: http://localhost:${PORT}\n`);
});
