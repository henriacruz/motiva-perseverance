# Motiva Perseverance

Robô mecatrônico tipo Rover para mecanização de serviços de roçagem em rodovias.

Projeto desenvolvido nas disciplinas do curso de **Engenharia Mecatrônica** — Centro Universitário FIAP, Turma 2EMR — 2026.

---

## Equipe

| Nome | RM |
|---|---|
| Cristiano dos Santos | RM566444 |
| Guilherme Gama Massela | RM563635 |
| Henrique Augusto Cruz | RM564586 |
| Leonardo Eiji Kowata | RM562934 |
| Leonardo Martins Trevisan | RM563752 |
| Vinicius Gonçalves Carneiro | RM561784 |

---

## Visão geral da solução

O Motiva Perseverance é um rover de seis rodas com dois braços robóticos SCARA equipados com lâminas de corte em nylon. O sistema opera de forma semi-autônoma via controle remoto (Dualshock 4) e transmite telemetria em tempo real por MQTT para um dashboard Node-RED.

**Funcionalidades principais:**

- Tração diferencial com 6 motores DC 130 controlados por pontes H L298N
- Dois braços SCARA com 3 graus de liberdade cada (steppers NEMA17 + driver TB6600)
- Localização via GPS NEO-6M
- Detecção de obstáculos com 4 sensores HC-SR04
- Monitoramento de inclinação e vibração via MPU-6050
- Monitoramento de consumo energético via INA219
- Telemetria IoT via MQTT (broker HiveMQ) com dashboard Node-RED
- Alertas em tempo real via Telegram

---

## Estrutura do repositório

```
motiva-perseverance/
├── firmware/
│   ├── esp32-main/          # tração, braços SCARA, servo, L298N, TB6600
│   ├── esp32-telemetry/     # sensores, GPS, MPU-6050, INA219, HC-SR04, MQTT
│   ├── shared-libs/         # utilitários compartilhados (MQTT helper, config)
│   ├── wokwi/               # simulação Wokwi (diagram.json + wokwi.toml)
│   └── platformio.ini       # configuração dos dois ambientes PlatformIO
│
├── dashboard/
│   ├── flows/               # flows.json do Node-RED versionado
│   ├── .env.example         # variáveis de ambiente (broker, tokens)
│   ├── package.json         # dependências Node-RED
│   └── screenshots/         # prints do dashboard
│
├── mqtt/
│   ├── topics.md            # contrato de tópicos e formato dos payloads
│   └── payloads/            # exemplos de JSON por sensor
│
├── docs/
│   ├── sprint-1.pdf         # especificações técnicas dos componentes
│   ├── architecture.md      # arquitetura detalhada do sistema
│   └── schematics/          # diagramas elétricos por módulo
│
└── .github/
    └── workflows/
        ├── build-firmware.yml   # CI: compila os dois ESP32 a cada push
        └── lint-flows.yml       # CI: valida o flows.json do Node-RED
```

---

## Pré-requisitos

### Firmware (ESP32)

- [VSCode](https://code.visualstudio.com/)
- Extensão [PlatformIO IDE](https://marketplace.visualstudio.com/items?itemName=platformio.platformio-ide)
- Driver USB-serial do seu conversor (CH340 ou CP2102)

### Dashboard (Node-RED)

- [Node.js](https://nodejs.org/) >= 18
- [Node-RED](https://nodered.org/) >= 3.x
- Pacotes adicionais (instalar via Manage Palette):
  - `@flowfuse/node-red-dashboard`
  - `node-red-contrib-telegrambot`

### Simulação (opcional)

- Extensão [Wokwi for VSCode](https://marketplace.visualstudio.com/items?itemName=Wokwi.wokwi-vscode) + licença gratuita em [wokwi.com](https://wokwi.com)

---

## Configuração rápida

### 1. Clone o repositório

```bash
git clone https://github.com/<org>/motiva-perseverance.git
cd motiva-perseverance
```

### 2. Configure as credenciais

```bash
cp dashboard/.env.example dashboard/.env
# edite dashboard/.env com suas credenciais reais
```

Variáveis necessárias:

```
HIVEMQ_BROKER=xxxx.s1.eu.hivemq.cloud
HIVEMQ_PORT=8883
HIVEMQ_USER=seu_usuario
HIVEMQ_PASS=sua_senha
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_CHAT_ID=-100xxxxxxxxx
```

> **Nunca faça commit do arquivo `.env`** — ele está no `.gitignore`.

### 3. Configure os segredos do firmware

Copie o arquivo de segredos e preencha:

```bash
cp firmware/shared-libs/secrets.h.example firmware/shared-libs/secrets.h
# edite secrets.h com SSID, senha WiFi e credenciais MQTT
```

> O arquivo `secrets.h` também está no `.gitignore`.

### 4. Compile e grave o firmware

Abra a pasta `firmware/` no VSCode com PlatformIO instalado:

```bash
# compilar ESP32 de telemetria
pio run -e esp32-telemetry

# compilar ESP32 principal
pio run -e esp32-main

# gravar via USB
pio run -e esp32-telemetry --target upload
pio run -e esp32-main --target upload

# abrir monitor serial
pio run -e esp32-telemetry --target monitor
```

### 5. Simule com Wokwi (opcional)

Com a extensão Wokwi instalada no VSCode, compile primeiro (`pio run -e esp32-telemetry`) e depois pressione `F1` → `Wokwi: Start Simulator`. O simulador usa o `.bin` compilado e publica MQTT no mesmo broker — o dashboard funciona sem alterações.

Consulte `firmware/wokwi/README-wokwi.md` para ver as diferenças entre o circuito simulado e o hardware real.

### 6. Importe o flow Node-RED

No Node-RED, vá em Menu → Import → selecione `dashboard/flows/flows.json`.

---

## Tópicos MQTT

| Tópico | Direção | Descrição |
|---|---|---|
| `motiva/telemetry` | ESP32 → broker | Dados de sensores (GPS, IMU, HC-SR04, INA219) |
| `motiva/status` | ESP32 → broker | Estado dos motores, bateria, modo de operação |
| `motiva/command` | broker → ESP32 | Comandos de movimento e corte |
| `motiva/alert` | ESP32 → broker | Alertas críticos (colisão, temperatura, bateria baixa) |

Payloads detalhados em [`mqtt/topics.md`](mqtt/topics.md).

---

## Branches e convenções

| Branch | Uso |
|---|---|
| `main` | código estável — entregues de sprint |
| `develop` | integração de features |
| `feat/nome` | desenvolvimento de funcionalidade |
| `fix/nome` | correção de bug |

Commits seguem o padrão `tipo(escopo): descrição` — ex: `feat(telemetry): adiciona leitura INA219`.

Tags de release marcam as entregas: `v0.1-sprint1`, `v0.2-sprint2`, etc.

---

## Documentação

- [`docs/architecture.md`](docs/architecture.md) — arquitetura detalhada, diagramas de fluxo
- [`mqtt/topics.md`](mqtt/topics.md) — contrato de tópicos e exemplos de payload
- `docs/schematics/` — diagramas elétricos por módulo
- `docs/sprint-1.pdf` — especificações técnicas dos componentes (Sprint 1)

---

## Licença

Projeto acadêmico — Centro Universitário FIAP, 2026.
