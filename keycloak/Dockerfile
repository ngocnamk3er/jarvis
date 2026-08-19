FROM quay.io/keycloak/keycloak:26.7.1

COPY themes/jarvis /opt/keycloak/themes/jarvis
COPY realm-export.json /opt/keycloak/data/import/realm-export.json

# Base image's own ENTRYPOINT (kc.sh) is kept as-is — only CMD is
# overridden, same as docker-compose.yml's `command: start-dev --import-realm`.
CMD ["start-dev", "--import-realm"]
