# Política de Segurança - Copa Tabuada CEIB 2026

## 🔒 Versões Suportadas

Apenas a versão mais recente do sistema recebe atualizações de segurança.

| Versão | Suportada |
|--------|-----------|
| 1.0.x (atual) | ✅ Sim |
| Versões anteriores | ❌ Não |

## 📧 Reportar uma Vulnerabilidade

**NÃO abra uma issue pública!** Isso pode expor problemas de segurança.

### Como reportar:
- 📱 **WhatsApp**: [Insira seu número aqui]
- 📧 **Email**: [Insira seu email aqui]
- 💬 **Contato direto com o Professor Henrique**

### O que esperar:
- ⏱️ Resposta em até **48 horas**
- 🔍 Investigação do problema
- 🔧 Correção em até **7 dias** (se aplicável)
- 🏆 Reconhecimento no README (se desejar)

### O que reportar:
- ✓ Problemas com injeção de código (XSS)
- ✓ Exposição de dados sensíveis
- ✓ Falhas na autenticação (senha `ceib2026`)
- ✓ Vulnerabilidades no Firebase
- ✓ Problemas com armazenamento local

## 🔐 Informações de Segurança

### Senha do Painel do Professor
A senha padrão é `ceib2026`. Recomenda-se alterá-la após a primeira configuração.

### Firebase
O projeto usa Firebase com as seguintes regras de segurança:
- Leitura e escrita permitidas (projeto escolar)
- Dados são anônimos (não requer login)

### Dados Locais
O sistema salva resultados no `localStorage` do navegador como fallback.

## ✅ Boas Práticas

Para manter a segurança do sistema:

1. 🔄 **Atualize regularmente** o código do Firebase
2. 🔑 **Altere a senha** do painel do professor
3. 📊 **Monitore** o histórico de duelos
4. 🗑️ **Limpe** registros antigos quando necessário

## 📜 Histórico

| Data | Versão | Alteração |
|------|--------|-----------|
| 2026-05-27 | 1.0 | Versão inicial |
