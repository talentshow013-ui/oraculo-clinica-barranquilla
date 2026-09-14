# Llave SSH del instalador (pública, se puede compartir)

Pégala en Hostinger al crear la VPS («Llave SSH») o después en hPanel → VPS → SSH keys.
Con ella, la instalación se hace desde el PC de la agencia con un solo comando:
`bash deploy/instalar-desde-aqui.sh <IP>`. No da acceso a nada más que a esa VPS.

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKED4mB8lfTL2ZHGNXlQcFrFjqUnH+3Gwm/tO2EdpMKl oraculo-instalador
```
