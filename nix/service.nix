{ self, ... }:
{
  nixosModules.service = { lib, config, pkgs, ... }: 
  {
    options.services.coco-label-tool = lib.mkOption {
      type = lib.types.attrsOf (lib.types.submodule {
        options = {
          enable = lib.mkOption {
            type = lib.types.bool;
            description = "Enable the Docs Book service";
            default = false;
          };

          coco-file = lib.mkOption {
            type = lib.types.str;
            description = "Path to COCO json file";
            example = "/var/lib/dataset/coco.json";
          };

          host = lib.mkOption {
            type = lib.types.str;
            description = "Hostname to listen on for HTTP connections";
            default = "localhost";
            example = "localhost";
          };

          port = lib.mkOption {
            type = lib.types.str;
            description = "Port to use for HTTP connections";
            default = "8000";
            example = "8000";
          };

          auto-label-config = lib.mkOption {
            type = lib.types.nullOr lib.types.str;
            description = "Path to auto-labeling YAML config file";
            default = null; 
            example = "/etc/coco-label-tool/auto-label-config.yaml";
          };

          after = lib.mkOption {
            type = lib.types.listOf lib.types.str;
            description = "List of systemd units that this service should start after";
            default = [ "network.target" ];
          };

          environment-file = lib.mkOption {
            type = lib.types.nullOr lib.types.str;
            description = "Path to an environment file to source for the service";
            default = null;
            example = "/etc/coco-label-tool/env";
          };
        };
      });
    };

    config = {
      systemd.services = lib.mapAttrs' (name: cfg: lib.nameValuePair name {
        description = "${name} service";
        after = cfg.after;
        wantedBy = [ "multi-user.target" ];
        serviceConfig = {
          ExecStart = ''
            ${self.packages.${pkgs.system}.default}/bin/coco-label-tool \
              --host ${cfg.host} \
              --port ${cfg.port} \
              ${lib.optionalString (cfg.auto-label-config != null) "--auto-label-config ${cfg.auto-label-config}"} \
              ${cfg.coco-file}
          '';
          Restart = "on-failure";
          EnvironmentFile = lib.optionalString (cfg.environmentFile != null) cfg.environment-file;
        };
      }) config.services.coco-label-tool;
    };
  };
}
