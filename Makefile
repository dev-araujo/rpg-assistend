.PHONY: install dev build start ingest ingest-force clean help

help: ## Mostra esta mensagem de ajuda
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

install: ## Instala as dependências do backend
	cd backend && npm install

dev: ## Inicia o servidor em modo desenvolvimento (hot-reload)
	cd backend && npm run dev

build: ## Compila o TypeScript para produção
	cd backend && npm run build

start: ## Inicia o servidor em modo produção (requer build)
	cd backend && npm start

ingest: ## Processa os PDFs em backend/data/ e gera os vetores
	cd backend && npm run ingest

ingest-force: ## Apaga vetores existentes e reinicia a ingestão do zero
	cd backend && npm run ingest:force

clean: ## Remove artefatos gerados (dist, vetores, cache de modelos)
	rm -rf backend/dist
	rm -rf backend/data/vectors
	rm -rf backend/.models
