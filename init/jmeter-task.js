var reg = require('cla/reg');

reg.register('service.task.jmeter', {
    name: 'Run JMeter Script',
    icon: 'plugin/cla-jmeter-plugin/icon/logo-jmeter.svg',
    form: '/plugin/cla-jmeter-plugin/form/jmeter-task-form.js',

    handler: function(ctx, params) {

        var regRemote = require('cla/reg');
        var fs = require('cla/fs');
        var path = require('cla/path');
        var log = require('cla/log');
        var digest = require("cla/digest");
        var proc = require("cla/process");

        var CLARIVE_BASE = proc.env('CLARIVE_BASE');
        var errorsType = params.errors || 'fail';
        var command = '';
        var output = '';

        var scriptPath = params.scriptPath || '/tmp/script.jmx';
        var scriptName = path.basename(scriptPath);

        var executionCode = digest.md5(ctx.stash('job_name'));

        var remotePath = path.join(params.remotePath || '/tmp', executionCode);
        var resultsPath  = path.join(remotePath, 'results');

        var buildJmeterCommand = function(params) {
            var command = 'jmeter -n';


            var remoteScript = path.join(remotePath, scriptName);

            var csvPath  = path.join(remotePath, (params.csvPath || 'script.csv'));

            var commandParameters = params.commandParameters || '';

            command += ' -t "' + remoteScript + '"';
            command += ' -l "' + csvPath + '"';
            command += ' -e -o "' + resultsPath + '"';

            command += ' ' + commandParameters;

            return command;
        }

        log.info("Starting JMeter execution.  Script " + scriptName);

        command = buildJmeterCommand(params);

        regRemote.launch('service.scripting.remote', {
            name: 'Create Remote Path',
            config: {
                errors: errorsType,
                server: params.server,
                path: 'mkdir -p ' + resultsPath
            }
        });

       
        regRemote.launch('service.scripting.remote', {
            name: 'Create Remote Path',
            config: {
                errors: errorsType,
                server: params.server,
                path: 'rm -rf ' + resultsPath + '/*'
            }
        });

        regRemote.launch('service.fileman.ship', {
            name: 'Send JMeter Sctipt',
            config: {
                server: params.server,
                user: params.remoteUser,
                recursive: "0",
                local_mode: "local_files",
                local_path: scriptPath,
                exist_mode_local: "skip",
                rel_path: "file_only",
                remote_path: remotePath,
                exist_mode: "reship",
                backup_mode: "none",
                rollback_mode: "none",
                track_mode: "none",
                audit_tracked: "none",
                chown: "",
                chmod: "",
                max_transfer_chunk_size: "",
                copy_attrs: "0"
            }
        });

        log.info("Script " + scriptName + " sent to JMeter server");

        log.info("Executing Script " + scriptName + ".  Please, be patient");

        var scriptOutput = regRemote.launch('service.scripting.remote', {
            name: 'Run JMeter Script',
            config: {
                errors: errorsType,
                server: params.server,
                path: command,
                output_error: params.output_error,
                output_warn: params.output_warn,
                output_capture: params.output_capture,
                output_ok: params.output_ok,
                meta: params.meta,
                rc_ok: params.rcOk,
                rc_error: params.rcError,
                rc_warn: params.rcWarn
            }
        });

        log.info("Script " + scriptName + " executed", scriptOutput.output);

        regRemote.launch('service.fileman.retrieve', {
            name: 'Retrieve JMeter results',
            config: {
                server: params.server,
                remote_path: resultsPath,
                local_path: path.join(CLARIVE_BASE,"plugins","cla-jmeter-plugin","public","jmeter_results",executionCode)
            },
        });

        log.info('<a target="_blank" href="/plugin/cla-jmeter-plugin/jmeter_results/' + executionCode + '/index.html">Click here to see the JMeter results</a>' );

        return scriptOutput;
    }
});
