# Sizing per environment: infra/ansible/host_vars/<env>.yml
DEPLOY_ENV ?= stage
DEPLOY_ARCH ?= amd64
TAG ?= $(shell git rev-parse --short=10 HEAD)
IMAGES=$(CURDIR)/bin/images
APP_ENV_FILE=.$(DEPLOY_ENV).env
DEPLOY_ENV_FILE=.deploy.$(DEPLOY_ENV).env
ANSIBLE=set -a; . ./$(DEPLOY_ENV_FILE); set +a; APP_ENV_FILE=$(APP_ENV_FILE) ANSIBLE_CONFIG=infra/ansible/ansible.cfg TAG=$(TAG) TIMESTAMP=$(TIMESTAMP) ansible-playbook --limit $(DEPLOY_ENV)

.PHONY: deploy_env
deploy_env:
	@case "$(DEPLOY_ENV)" in stage|prod) ;; *) echo "DEPLOY_ENV must be stage or prod, not '$(DEPLOY_ENV)'"; exit 1;; esac
	@test -f $(DEPLOY_ENV_FILE) || { echo "Missing $(DEPLOY_ENV_FILE) (copy .deploy.env.example)"; exit 1; }

.PHONY: app_env
app_env: deploy_env
	@test -f $(APP_ENV_FILE) || { echo "Missing $(APP_ENV_FILE) (copy .env.example)"; exit 1; }

.PHONY: image
image: deps lint ## Builds the api and web images for the server
	@mkdir -p $(IMAGES)
	@cd web && bun run build
	@${DOCKER} build --pull=newer --platform linux/$(DEPLOY_ARCH) -f infra/Dockerfile -t localhost/dwb-courses-api:$(TAG) .
	@${DOCKER} build --pull=newer --platform linux/$(DEPLOY_ARCH) -f infra/Dockerfile.web -t localhost/dwb-courses-web:$(TAG) .
	@${DOCKER} save localhost/dwb-courses-api:$(TAG) | gzip -n > $(IMAGES)/api.tar.gz
	@${DOCKER} save localhost/dwb-courses-web:$(TAG) | gzip -n > $(IMAGES)/web.tar.gz

.PHONY: host_first
host_first: deploy_env ## Sets up a new server, once (as DEPLOY_BOOTSTRAP_USER, default root)
	@$(ANSIBLE) infra/ansible/host.yml -e ansible_user=$${DEPLOY_BOOTSTRAP_USER:-root}

.PHONY: host
host: deploy_env ## Applies the host configuration again
	@$(ANSIBLE) infra/ansible/host.yml

.PHONY: deploy
deploy: app_env image ## Builds and deploys the images and configuration
	@$(ANSIBLE) infra/ansible/deploy.yml

.PHONY: rollback
rollback: deploy_env ## Runs the images of the previous deploy
	@$(ANSIBLE) infra/ansible/rollback.yml

.PHONY: db_verify
db_verify: deploy_env ## Restores the replica into a temporary directory and checks it
	@$(ANSIBLE) infra/ansible/db_verify.yml

.PHONY: db_restore
db_restore: deploy_env ## Replaces the database with the replica (optionally TIMESTAMP=2026-10-18T09:00:00Z)
	@$(ANSIBLE) infra/ansible/db_restore.yml
