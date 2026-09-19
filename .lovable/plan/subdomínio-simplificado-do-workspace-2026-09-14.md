# Subdomínio simplificado do workspace

## Alterações
- Remover o campo “Domínio público” das configurações do workspace.
- Manter apenas o campo onde cada pessoa escolhe o nome do subdomínio.
- Mostrar sempre o resultado no formato `nome.novawebinar.com`.
- Usar `novawebinar.com` como base automática para todos os links das salas, incluindo quando ainda não existe configuração antiga guardada.
- Continuar a validar o formato e impedir subdomínios repetidos.

## Detalhes técnicos
- Ajustar a criação dos endereços públicos para aplicar o subdomínio sobre `https://novawebinar.com`.
- Ao guardar o workspace, atualizar apenas o nome e o subdomínio; o domínio base deixa de ser editável.
