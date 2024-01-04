# nix-instantiate --eval -E '(import <nixpkgs> {}).lib.version'
{ pkgs ? import (fetchTarball "https://github.com/NixOS/nixpkgs/archive/e842355edcac799ef58a79b83fea3827b371552a.tar.gz") {} }:

pkgs.mkShell {
  buildInputs = [
    pkgs.nodejs
    #pkgs.curl
    pkgs.yarn
    #pkgs.git
    pkgs.google-chrome
  ];
}
