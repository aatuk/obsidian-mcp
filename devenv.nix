{ pkgs, lib, config, inputs, ... }:

{
  packages = with pkgs; [
    git
    nodejs_20
    nodePackages.typescript
    nodePackages.typescript-language-server
  ];

  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_20;
  };

  languages.typescript = {
    enable = true;
  };

  enterShell = ''
    echo "Obsidian HTTP MCP Plugin Development Environment"
    echo "Node.js version: $(node --version)"
    echo "npm version: $(npm --version)"
    echo ""
    echo "Commands:"
    echo "  npm install    - Install dependencies"
    echo "  npm run dev    - Start development build watcher"
    echo "  npm run build  - Create production build"
    echo ""
  '';

  scripts.setup.exec = ''
    npm install
    echo "Dependencies installed!"
  '';

  scripts.watch.exec = ''
    npm run dev
  '';

  scripts.build-prod.exec = ''
    npm run build
  '';

  processes.dev.exec = "npm run dev";

  pre-commit.hooks = {
    prettier = {
      enable = true;
      excludes = [ "main\\.js" ".*\\.md" ];
      # Run prettier and auto-stage the formatted files
      # This prevents the "files were modified by this hook" error
      entry = lib.mkForce "${pkgs.writeShellScript "prettier-auto-stage" ''
        #!/usr/bin/env bash
        files=("$@")
        ${pkgs.prettier}/bin/prettier --write "''${files[@]}"
        git add "''${files[@]}"
      ''}";
    };
  };
}