# Girls Wallet

Aplicativo mobile para organização financeira pessoal, com registro de despesas, acompanhamento de limites e metas, relatórios, funcionamento offline e importação revisável de faturas PDF.

> **Importante:** o app não acessa nem importa e-mails. A importação começa quando a pessoa seleciona uma fatura PDF no próprio dispositivo. PDF digitalizado, protegido por senha ou com estrutura ainda não reconhecida é recusado com uma mensagem; OCR não faz parte desta versão.

## Telas e fluxos

As telas seguem a referência [Girls Wallet no Figma](https://www.figma.com/design/MBJlnSJrTKJS8mkGFBhb9Y/Girls-Wallet?node-id=0-1&p=f&t=rFIZCC0Dp1scJ7gx-0): interface em português, valores em reais, fundo claro, tons de rosa/malva, cartões arredondados e navegação inferior por cinco áreas.

- **Acesso:** login por e-mail/senha ou Google, cadastro e recuperação de senha.
- **Início:** previsão do saldo disponível, resumo do orçamento, acesso rápido para registrar despesa/importar fatura e meta ativa.
- **Despesas:** busca, filtro de recorrentes/variáveis, listagem paginada, criação, edição e exclusão.
- **Orçamento:** cálculo de saldo disponível e visão dos limites por categoria.
- **Categorias:** criar/editar categorias e limites; alerta ao ultrapassar o orçamento.
- **Gastos fixos:** listagem e inclusão de despesas recorrentes.
- **Cartões e faturas:** cadastrar, editar e excluir cartões, consultar faturas importadas e seus lançamentos.
- **Importar fatura:** escolher cartão, período e PDF; processar a fatura na API; revisar, corrigir, remover e confirmar compras; evitar duplicidades.
- **Metas:** criar, editar, excluir e acompanhar objetivo, valor poupado, aporte mensal e data desejada.
- **Relatórios:** total registrado, gráficos por categoria e evolução mensal.
- **Perfil e configurações:** renda, despesas fixas, reserva, notificações, sincronização e encerramento de sessão.

O modo **Explorar sem conta** usa um conjunto de dados demonstrativos isolado. Ele não é enviado ao Firebase. Uma conta real começa em um banco local separado, sem os dados de demonstração.

## Tecnologias

| Camada | Tecnologias |
| --- | --- |
| App | React Native, Expo, TypeScript, React Navigation |
| Offline | SQLite via `expo-sqlite`; listagem local paginada |
| Autenticação | Firebase Authentication (e-mail/senha e Google); persistência de autenticação com `expo-secure-store` |
| Sincronização | Firestore, sincronização por conta quando há rede |
| Arquivos | Expo Document Picker; envio de PDF selecionado para a API |
| API | Node.js, Express, TypeScript |
| Faturas | `pdf-parse`; extração de texto e parser extensível; sem OCR |
| Push | Firebase Cloud Messaging via Firebase Admin; alertas locais com Expo Notifications |

## Arquitetura

```mermaid
flowchart TD
  U[Pessoa usuária] --> APP[Expo / React Native]
  APP --> AUTH[Firebase Authentication]
  APP --> LOCAL[SQLite por conta]
  APP -->|online: sincroniza registros| FS[(Firestore)]
  APP -->|PDF selecionado| API[Node / Express]
  API --> PDF[Extração de texto PDF]
  PDF --> PARSER[Parser e sugestão de categoria]
  PARSER --> REVIEW[Revisão explícita no app]
  REVIEW --> LOCAL
  APP -->|limite ultrapassado| FCM[Firebase Cloud Messaging]
  FCM --> DEVICE[Dispositivo]
```

- Cada conta e o modo de demonstração usam arquivos SQLite separados.
- Dados criados offline permanecem no dispositivo e são reconciliados com `users/{uid}/records` quando a conexão retorna. Em conflito, prevalece o registro com `updatedAt` mais recente.
- As regras em [`firebase/firestore.rules`](./firebase/firestore.rules) restringem cada conta ao próprio caminho.
- O PDF é analisado em memória na API; o arquivo original não é persistido pelo servidor. Nenhuma compra extraída é gravada antes da confirmação no app.
- A extração genérica atende layouts digitais que apresentem compras em linhas com data, descrição e valor. Layouts de emissores variam; adapte/adicone regras de parser para formatos não reconhecidos. O app informa a falha e não salva uma análise vazia.
- Alertas locais funcionam no dispositivo. Push remoto exige configuração de Firebase Admin, token FCM e credenciais nativas da plataforma.

## Requisitos

- Node.js 20 ou superior e npm.
- Expo Go para prototipagem ou toolchain nativa Android/iOS para compilar a versão final.
- Projeto Firebase com Authentication (e-mail/senha e Google) e Firestore habilitados.
- Para PDF, API Express disponível na rede do aparelho.
- Para push remoto, Firebase Admin credentials, configuração FCM do Android e credenciais APNs do iOS.

## Instalação e execução

Na raiz do repositório, em PowerShell:

```powershell
Copy-Item mobile\.env.example mobile\.env
Copy-Item server\.env.example server\.env

Set-Location mobile
npm install
npx expo start
```

Em outro terminal:

```powershell
Set-Location server
npm install
npm run dev
```

Preencha `mobile/.env` com a configuração pública do app Firebase:

```dotenv
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
EXPO_PUBLIC_API_URL=http://localhost:4000
```

Para testar em um telefone físico, substitua `localhost` pelo endereço IP local do computador onde a API está rodando. As variáveis Firebase `EXPO_PUBLIC_*` são configurações de cliente, não substituem as regras de segurança. Nunca coloque a chave privada da conta de serviço Firebase no app.

Em `server/.env`, configure `FIREBASE_PROJECT_ID` e `GOOGLE_APPLICATION_CREDENTIALS` com o caminho local para a credencial de serviço. A credencial deve permanecer fora do repositório. O endpoint `/health` verifica a API; a análise de PDF é `POST /api/statements/analyze` (multipart/form-data, campo `file`, limite de 10 MB).

Para ativar login Google, cadastre os três OAuth Client IDs para os respectivos ambientes. Para distribuir builds nativos com push remoto, configure também o arquivo/serviço Firebase Android e APNs do iOS e registre cada dispositivo em `POST /api/push/register`.

## Testes e validação

```powershell
Set-Location mobile
npx tsc --noEmit

Set-Location ..\server
npm run build
npm test
```

## Auditoria de dependências

O `npm audit` do servidor terminou sem vulnerabilidades após atualizar `firebase-admin`. No app, ainda há 15 alertas HIGH nos pacotes de desenvolvimento Expo/React Native (`metro`, `node-forge` e `braces`, entre dependências relacionadas). O registro do npm não oferece correção compatível com o SDK atual; `npm audit fix` sugere downgrades incompatíveis (Expo 44 / React Native 0.72), que não foram aplicados. Reavalie quando o Expo publicar versões corrigidas compatíveis com o SDK 58.

## Capturas de tela

Para registrar imagens reais do app, execute o Expo, abra as jornadas no emulador/dispositivo e salve as capturas em `docs/screenshots/` antes de publicá-las. A referência visual das telas está no [arquivo Figma](https://www.figma.com/design/MBJlnSJrTKJS8mkGFBhb9Y/Girls-Wallet?node-id=0-1&p=f&t=rFIZCC0Dp1scJ7gx-0).
