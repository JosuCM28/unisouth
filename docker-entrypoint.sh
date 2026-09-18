#!/bin/sh
# ═══════════════════════════════════════════════════════════════════════════
#  Arranque del contenedor: primero la base, luego la app.
#
#  `migrate deploy` aplica los .sql que ya están escritos y que esta base
#  todavía no tiene registrados. NO inventa migraciones, NO compara el schema
#  contra la base y NO ofrece resetear nada: eso es `migrate dev`, que es de
#  desarrollo y jamás debe correr aquí.
#
#  Existe para cerrar la puerta por la que se coló el desfase: mientras los
#  cambios de esquema entraban a producción con `db push` a mano, la historia
#  de migraciones dejó de producir el esquema real y `migrate dev` acabó sin
#  más salida que ofrecer borrar la base entera.
# ═══════════════════════════════════════════════════════════════════════════

# Si la migración falla, el contenedor NO arranca.
#
# Es deliberado y es lo importante de esta línea: más vale un deploy caído
# —con el contenedor anterior todavía sirviendo, porque Dokploy sólo manda
# tráfico cuando el healthcheck pasa— que la app corriendo contra un esquema
# a medias. Lo segundo se ve como datos corruptos días después.
set -e

echo "→ Aplicando migraciones pendientes…"

# Se invoca el bundle del CLI directamente y no `npx prisma`: npx lo buscaría
# en la red si no lo encuentra, y un deploy no puede depender de que el
# registro de npm esté arriba.
#
# Con varias réplicas arrancando a la vez no hay problema: Prisma toma un
# advisory lock de Postgres mientras migra, así que una aplica y las demás
# esperan y encuentran el trabajo hecho.
node prisma-cli/node_modules/prisma/build/index.js migrate deploy

echo "→ Arrancando la aplicación"

# `exec` para que el servidor quede como PID 1 y reciba el SIGTERM de Docker:
# sin esto, un `docker stop` mataría al shell y el proceso de Node se iría a
# la fuerza a los diez segundos, a media petición.
exec node server.js
