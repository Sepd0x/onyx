# Onyx — Roadmap de Desenvolvimento

Este documento mapeia o futuro do desenvolvimento da aplicação **Onyx**, integrando ideias avançadas de IA e utilidades para developers. A nossa abordagem é modular: construiremos e testaremos uma funcionalidade de cada vez, garantindo robustez e integração impecável.

## 🌟 Fase 1: AI App & Repo Manager (O Cérebro Central)
Esta é a integração máxima (The Big Idea) que cruza o *Git Pulse* e o sistema local.
- [x] **Deteção Repo Remoto -> Local:** Se um repositório do GitHub for adicionado, a app deve conseguir procurar no disco local (`~/Documents/GitHub`, `~/Desktop`, etc.) se o projeto já está guardado fisicamente, e ligar automaticamente o contexto.
- [x] **Análise de Sincronização:** O AI cruza os *commits* e avisa se o diretório local está desatualizado face ao remoto.
- [x] **Smart App Tracker:** Para aplicações construídas (seja Windows Build ou portátil) que nasçam desses repositórios, o Onyx vai conseguir "anexar" esse binário e controlá-lo.
- [x] **AI Auditor (Dashboard Central):** Uma aba dedicada que reporta proativamente as sincronizações do Repositório (Desyncs), controla sub-binários e vasculha os STDOUT (*logs*) e injeta deteção de fugas de memórias em tempo real.

## 🔍 Fase 2: DevWatcher & Port Auditor 2.0 (Inteligência Tática)
Expandir a auditoria e os processos em tempo real.
- [x] **AI Error Detection em tempo real:** O DevWatcher passará a "escutar" o terminal das sub-apps e o AI avisa-nos logo que detete "Pode haver aqui um Memory Leak" ou "Exceção fatal na linha 45".
- [x] **Auto-Restart & Healing:** Se uma app der *crash*, o AI tenta analisar a porta e o log, liberta a porta "presa" (Network Auditing avançado) e reinicia o *dev server*.
- [ ] **Port Auditor Profiling:** Estudar que portas estão abertas não só na máquina virtual/local mas como elas pingam para fora e medir latências.

## 🛠 Fase 3: Quality of Life & Non-AI Power Tools
Ferramentas para dominar o *Workflow* de programação do dia a dia.
- [x] **UI & Visual Polish:** Um design base minimalista premium (Midnight/OLED), com suporte a efeitos visuais expansivos (*Orbs* animados, *glows*, *fade-ins*) que podem ser desativados nativamente na tab de Settings (Optimize UX para máquinas lentas).
- [x] **OS Power Manager (AI Assisted):** Uma "Power Plan" interface conectada ao status de energia da máquina (Bateria / AC). Permite controlo híbrido entre underclock em Background (`Battery Saver`) e `Max Performance`. Se o AI Toggle estiver ativo, auto-gestão inteligente disparando Notificações de sistema ricas baseadas no load atual.
- [x] **Module Controls & Anti-Spam:** Adicionada a flag global `Enable System Notifications` na tab de definições com auto-limite de sub-janelas, atenuando *bloatware* indesejado num uso estrito e *opt-in* de todas as features de telemetria AI.
- [x] **Kill Switch & Limiter:** Limitar uso de CPU temporariamente para certas apps (ex. Docker ou Node zumbi que esteja a sugar 100% CPU) e opção "Kill" instantânea ("End Process Tree").
- [x] **System Tray Mini-Dashboard:** Um visualizador de 1 clique junto ao relógio do Windows/Mac para ver a RAM/CPU, portas ativas e gerir ferramentas rapidamente sem abrir a app toda.
- [x] **One-Click Local Env Setup:** Botão mágico que arranca o PostgreSQL, o backend Node, e o frontend React nas respetivas portas só num clique (Launch Profiles).
- [x] **Dev Cleanser (`node_modules` remover):** Um scan rápido que descobre todos os diretorios `.git` ou `node_modules` de repos antigos e inativos, mostrando quanto espaço podemos limpar num painel visual (Poupança massiva de SSD). 
- [x] **Command Snippet Manager:** Guardar e gerir rapidamente scripts que digitamos muito no terminal, prontos a colar.
- [x] **Global Hotkeys:** Ligar atalhos de teclado OS-level (Ex: `CTRL+ALT+D` abre instantaneamente o painel de portas).

## 🐋 Fase 4: O Futuro (Docker & Containers)
- [ ] **Gestão Visual de Containers:** Não implementado para já, mas no roadmap para o futuro, para permitir start/stop de containers Docker diretamente da interface, em harmonia com o DevWatcher.

---
**Regra de Ouro:** Focar na estabilidade. Passo a passo. Testar cada feature no ecossistema (UI -> IPC -> Main -> Sistema Operativo) e verificar latência / CPU load do próprio Onyx antes de saltar para a próxima etapa.
