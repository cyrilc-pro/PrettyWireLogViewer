var WireLogParser = (function () {
    'use strict';

    var RequestLog = (function () {
        function RequestLog(arg) {
            this.log = arg.log;
            this.type = arg.type;
            if (arg.headerName) {
                this.headerName = arg.headerName;
            }
        }
        return RequestLog;
    }());

    var ResponseLog = (function () {
        function ResponseLog(arg) {
            this.log = arg.log;
            this.type = arg.type;
            if (arg.headerName) {
                this.headerName = arg.headerName;
            }
        }
        return ResponseLog;
    }());

    function WireLogParser(doesRemoveNewLine) {
        if (doesRemoveNewLine !== false) {
            doesRemoveNewLine = true;
        }
        this.doesRemoveNewLine = doesRemoveNewLine;
    }

    WireLogParser.prototype.parse = function (logText) {
        var extractHeaderName = function (log) {
            var found = log.match(/^([^:]+?):/);
            if (found) {
                return found[1];
            }

            return undefined;
        };

        var removeNewLine = function (log) {
            return log.replace(/(\[\\r\])?\[\\n\]/, ''); // remove string like so "[\r][\n]"
        };

        var assembleLogObj = function (args) {
            var self = args.self,
                log = args.log,
                group = args.group,
                logContainer = args.logContainer,
                LogClass = args.LogClass,
                direction = args.direction;

            if (self.doesRemoveNewLine === true) {
                log = removeNewLine(log);
            }

            var type = 'body';

            // init (at the 1st line of request or response)
            if ((logContainer[group] instanceof Array) === false) {
                logContainer[group] = [];
                type = 'http-' + direction;
            }

            var headerName = extractHeaderName(log);
            if (typeof headerName !== 'undefined') {
                type = 'header';
            }

            // To set 'body' into `type` when log is beyond the blank line
            var logBlock = logContainer[group];
            var lastLogItem = logContainer[group][logBlock.length - 1];
            if (typeof lastLogItem !== 'undefined' && lastLogItem.type === 'body') {
                type = 'body';
                headerName = undefined;
            }

            logContainer[group].push(
                new LogClass({
                    'log': log,
                    'type': type,
                    'headerName': headerName
                })
            );
        };

        var requestLogByGroup = [];
        var responseLogByGroup = [];

        var line, lineNum, found;
        var lines = logText.split(/\r?\n/);
        var numOfLines = lines.length;
        for (lineNum = 0; lineNum < numOfLines; lineNum++) {
            line = lines[lineNum];

            // ignore not wire log
            if (!line.match(/org\.apache\.http\.wire/)) {
                continue;
            }

            // for request
            found = line.match(/.*http-outgoing-([0-9]+) >> ("?)(.*)\2/);
            if (found) {
                assembleLogObj({
                    'self': this,
                    'log': found[3],
                    'group': found[1],
                    'logContainer': requestLogByGroup,
                    'LogClass': RequestLog,
                    'direction': 'request'
                });
                continue;
            }

            // for response
            found = line.match(/.*http-outgoing-([0-9]+) << ("?)(.*)\2/);
            if (found) {
                assembleLogObj({
                    'self': this,
                    'log': found[3],
                    'group': found[1],
                    'logContainer': responseLogByGroup,
                    'LogClass': ResponseLog,
                    'direction': 'response'
                });
                continue;
            }
        }

        var length = requestLogByGroup.length;
        if (length - responseLogByGroup.length < 0) {
            length = responseLogByGroup.length;
        }

        return {
            'requestLog': requestLogByGroup,
            'responseLog': responseLogByGroup,
            'length': length
        };
    };

    return WireLogParser;
}());

// for testing
if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') {
   exports.WireLogParser = WireLogParser;
}