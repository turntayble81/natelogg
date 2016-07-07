var util = require('util');
var moment = require('moment');

function Bunyan(opts) {
    var _this = this;

    this.TIME_UTC   = 1;  // the default, bunyan's native format
    this.TIME_LOCAL = 2;

    this.OM_LONG    = 1;
    this.OM_JSON    = 2;
    this.OM_INSPECT = 3;
    this.OM_SIMPLE  = 4;
    this.OM_SHORT   = 5;
    this.OM_BUNYAN  = 6;

    this.TRACE = 10;
    this.DEBUG = 20;
    this.INFO  = 30;
    this.WARN  = 40;
    this.ERROR = 50;
    this.FATAL = 60;

    this.TIMEZONE_UTC_FORMATS = {
        long:  '[[]YYYY-MM-DD[T]HH:mm:ss.SSS[Z][]]',
        short: 'HH:mm:ss.SSS[Z]'
    };
    this.TIMEZONE_LOCAL_FORMATS = {
        long:  '[[]YYYY-MM-DD[T]HH:mm:ss.SSSZ[]]',
        short: 'HH:mm:ss.SSS'
    };

    this.OM_FROM_NAME = {
        'long'    : this.OM_LONG,
        'paul'    : this.OM_LONG,  /* backward compat */
        'json'    : this.OM_JSON,
        'inspect' : this.OM_INSPECT,
        'simple'  : this.OM_SIMPLE,
        'short'   : this.OM_SHORT,
        'bunyan'  : this.OM_BUNYAN
    };

    this.TIME_FROM_NAME = {
        'UTC'   : this.TIME_UTC,
        'local' : this.TIME_LOCAL
    };

    this.opts = opts || {};

    this.opts.args       = this.opts.args       || [];
    this.opts.help       = this.opts.help       || false;
    this.opts.color      = this.opts.color      || true;
    this.opts.colorMode  = this.opts.colorMode  || 'HTML';  //HTML by default or ANSI
    this.opts.paginate   = this.opts.paginate   || null;
    this.opts.outputMode = this.OM_FROM_NAME[this.opts.outputMode] || this.OM_LONG;
    this.opts.jsonIndent = this.opts.jsonIndent || 2;
    this.opts.level      = this.opts.level      || null;
    this.opts.strict     = this.opts.strict     || false;
    this.opts.pids       = this.opts.pids       || null;
    this.opts.pidsType   = this.opts.pidsType   || null;
    this.opts.timeFormat = this.TIME_FROM_NAME[this.opts.timeFormat] || this.TIME_UTC;

    // http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
    this.ANSIColors = {
        'bold'      : [1, 22],
        'italic'    : [3, 23],
        'underline' : [4, 24],
        'inverse'   : [7, 27],
        'white'     : [37, 39],
        'grey'      : [90, 39],
        'black'     : [30, 39],
        'blue'      : [34, 39],
        'cyan'      : [36, 39],
        'green'     : [32, 39],
        'magenta'   : [35, 39],
        'red'       : [31, 39],
        'yellow'    : [33, 39]
    };

    this.HTMLColors = {
        'bold'      : ['<span style="font-weight: bold;">', '</span>'],
        'italic'    : ['<span style="font-style: italic;">', '</span>'],
        'underline' : ['<span style="text-decoration: underline;">', '</span>'],
        'inverse'   : ['<span style="filter: invert(100%);">', '</span>'],
        'white'     : ['<span style="color: white;">', '</span>'],
        'grey'      : ['<span style="color: grey;">', '</span>'],
        'black'     : ['<span style="color: black;">', '</span>'],
        'blue'      : ['<span style="color: blue;">', '</span>'],
        'cyan'      : ['<span style="color: cyan;">', '</span>'],
        'green'     : ['<span style="color: green;">', '</span>'],
        'magenta'   : ['<span style="color: magenta;">', '</span>'],
        'red'       : ['<span style="color: red;">', '</span>'],
        'yellow'    : ['<span style="color: yellow">', '</span>']
    };

    var levelFromName = {
        'trace' : this.TRACE,
        'debug' : this.DEBUG,
        'info'  : this.INFO,
        'warn'  : this.WARN,
        'error' : this.ERROR,
        'fatal' : this.FATAL
    };

    this.format = util.format;

    this.nameFromLevel = {};
    this.upperNameFromLevel = {};
    this.upperPaddedNameFromLevel = {};

    Object.keys(levelFromName).forEach(function(name) {
        var lvl = levelFromName[name];

        _this.nameFromLevel[lvl] = name;
        _this.upperNameFromLevel[lvl] = name.toUpperCase();
        _this.upperPaddedNameFromLevel[lvl] = (name.length === 4 ? ' ' : '') + name.toUpperCase();
    });
}

Bunyan.prototype.handleLogLine = function(line) {
    // Emit non-JSON lines immediately.
    var opts = this.opts;
    var rec;
    if(!line) {
        if(!opts.strict) {
            return line;
        }
    }else if (line[0] !== '{') {
        if(!opts.strict) {
            return line;  // not JSON
        }else {
            return;
        }
    }else {
        try {
            rec = JSON.parse(line);
        }catch(e) {
            if(!opts.strict) {
                return line;
            }
        }
    }

    if(!this.isValidRecord(rec)) {
        if(!opts.strict) {
            return line;
        }
    }

    if(!this.filterRecord(rec)) {
        return;
    }

    return this.emitRecord(rec, line);
}

Bunyan.prototype.isValidRecord = function(rec) {
    if(rec.v == null ||
            rec.level == null ||
            rec.name == null ||
            rec.hostname == null ||
            rec.pid == null ||
            rec.time == null ||
            rec.msg == null) {
            // Not valid Bunyan log.
        return false;
    }else {
        return true;
    }
};

Bunyan.prototype.filterRecord = function(rec) {
    var opts = this.opts;

    if(opts.level && rec.level < opts.level) {
        return false;
    }

    if(opts.conditions) {
        var recCopy = this.objCopy(rec);
        for(var i = 0; i < opts.conditions.length; i++) {
            var pass = opts.conditions[i].call(recCopy);
            if(!pass) {
                return false;
            }
        }
    }

    return true;
};

Bunyan.prototype.emitRecord = function(rec, line) {
    var _this = this;
    var opts = this.opts;
    var stylize = this.stylize;
    var short = false;
    var retval;

    switch (opts.outputMode) {
    case this.OM_SHORT:
        short = true;
        /* jsl:fall-thru */

    case this.OM_LONG:
        //    [time] LEVEL: name[/comp]/pid on hostname (src): msg* (extras...)
        //        msg*
        //        --
        //        long and multi-line extras
        //        ...
        // If 'msg' is single-line, then it goes in the top line.
        // If 'req', show the request.
        // If 'res', show the response.
        // If 'err' and 'err.stack' then show that.
        if (!this.isValidRecord(rec)) {
            retval = line;
            break;
        }

        delete rec.v;

        // Time.
        var time;
        if (!short && opts.timeFormat === this.TIME_UTC) {
            // Fast default path: We assume the raw `rec.time` is a UTC time
            // in ISO 8601 format (per spec).
            time = '[' + rec.time + ']';
        } else if (!moment && opts.timeFormat === this.TIME_UTC) {
            // Don't require momentjs install, as long as not using TIME_LOCAL.
            time = rec.time.substr(11);
        } else {
            var tzFormat;
            var moTime = moment(rec.time);
            switch (opts.timeFormat) {
            case this.TIME_UTC:
                tzFormat = this.TIMEZONE_UTC_FORMATS[short ? 'short' : 'long'];
                moTime.utc();
                break;
            case this.TIME_LOCAL:
                tzFormat = this.TIMEZONE_LOCAL_FORMATS[short ? 'short' : 'long'];
                break;
            default:
                throw new Error('unexpected timeFormat: ' + opts.timeFormat);
            };
            time = moTime.format(tzFormat);
        }
        time = this.stylize(time, 'XXX');
        delete rec.time;

        var nameStr = rec.name;
        delete rec.name;

        if (rec.component) {
            nameStr += '/' + rec.component;
        }
        delete rec.component;

        if (!short)
            nameStr += '/' + rec.pid;
        delete rec.pid;

        var level = (this.upperPaddedNameFromLevel[rec.level] || 'LVL' + rec.level);
        if (opts.color) {
            var colorFromLevel = {
                10: 'white',    // TRACE
                20: 'yellow',   // DEBUG
                30: 'cyan',     // INFO
                40: 'magenta',  // WARN
                50: 'red',      // ERROR
                60: 'inverse',  // FATAL
            };
            level = this.stylize(level, colorFromLevel[rec.level]);
        }
        delete rec.level;

        var src = '';
        if (rec.src && rec.src.file) {
            var s = rec.src;
            if (s.func) {
                src = this.format(' (%s:%d in %s)', s.file, s.line, s.func);
            } else {
                src = this.format(' (%s:%d)', s.file, s.line);
            }
            src = this.stylize(src, 'green');
        }
        delete rec.src;

        var hostname = rec.hostname;
        delete rec.hostname;

        var extras = [];
        var details = [];

        if (rec.req_id) {
            extras.push('req_id=' + rec.req_id);
        }
        delete rec.req_id;

        var onelineMsg;
        if (rec.msg.indexOf('\n') !== -1) {
            onelineMsg = '';
            details.push(this.indent(this.stylize(rec.msg, 'cyan')));
        } else {
            onelineMsg = ' ' + this.stylize(rec.msg, 'cyan');
        }
        delete rec.msg;

        if (rec.req && typeof (rec.req) === 'object') {
            var req = rec.req;
            delete rec.req;
            var headers = req.headers;
            if (!headers) {
                headers = '';
            } else if (typeof (headers) === 'string') {
                headers = '\n' + headers;
            } else if (typeof (headers) === 'object') {
                headers = '\n' + Object.keys(headers).map(function (h) {
                    return h + ': ' + headers[h];
                }).join('\n');
            }
            var s = this.format('%s %s HTTP/%s%s', req.method,
                req.url,
                req.httpVersion || '1.1',
                headers
            );
            delete req.url;
            delete req.method;
            delete req.httpVersion;
            delete req.headers;
            if (req.body) {
                s += '\n\n' + (typeof (req.body) === 'object'
                    ? JSON.stringify(req.body, null, 2) : req.body);
                delete req.body;
            }
            if (req.trailers && Object.keys(req.trailers) > 0) {
                s += '\n' + Object.keys(req.trailers).map(function (t) {
                    return t + ': ' + req.trailers[t];
                }).join('\n');
            }
            delete req.trailers;
            details.push(this.indent(s));
            // E.g. for extra 'foo' field on 'req', add 'req.foo' at
            // top-level. This *does* have the potential to stomp on a
            // literal 'req.foo' key.
            Object.keys(req).forEach(function (k) {
                rec['req.' + k] = req[k];
            })
        }

        if (rec.client_req && typeof (rec.client_req) === 'object') {
            var client_req = rec.client_req;
            delete rec.client_req;
            var headers = client_req.headers;
            var hostHeaderLine = '';
            var s = '';
            if (client_req.address) {
                hostHeaderLine = '\nHost: ' + client_req.address;
                if (client_req.port)
                    hostHeaderLine += ':' + client_req.port;
            }
            delete client_req.headers;
            delete client_req.address;
            delete client_req.port;
            s += this.format('%s %s HTTP/%s%s%s', client_req.method,
                client_req.url,
                client_req.httpVersion || '1.1',
                hostHeaderLine,
                (headers ?
                    '\n' + Object.keys(headers).map(
                        function (h) {
                            return h + ': ' + headers[h];
                        }).join('\n') :
                    ''));
            delete client_req.method;
            delete client_req.url;
            delete client_req.httpVersion;
            if (client_req.body) {
                s += '\n\n' + (typeof (client_req.body) === 'object' ?
                    JSON.stringify(client_req.body, null, 2) :
                    client_req.body);
                delete client_req.body;
            }
            // E.g. for extra 'foo' field on 'client_req', add
            // 'client_req.foo' at top-level. This *does* have the potential
            // to stomp on a literal 'client_req.foo' key.
            Object.keys(client_req).forEach(function (k) {
                rec['client_req.' + k] = client_req[k];
            })
            details.push(this.indent(s));
        }

        function _res(res) {
            var s = '';
            if (res.statusCode !== undefined) {
                s += _this.format('HTTP/1.1 %s %s\n', res.statusCode,
                    http.STATUS_CODES[res.statusCode]);
                delete res.statusCode;
            }
            // Handle `res.header` or `res.headers` as either a string or
            // and object of header key/value pairs. Prefer `res.header` if set
            // (TODO: Why? I don't recall. Typical of restify serializer?
            // Typical JSON.stringify of a core node HttpResponse?)
            var headerTypes = {string: true, object: true};
            var headers;
            if (res.header && headerTypes[typeof (res.header)]) {
                headers = res.header;
                delete res.header;
            } else if (res.headers && headerTypes[typeof (res.headers)]) {
                headers = res.headers;
                delete res.headers;
            }
            if (headers === undefined) {
                /* pass through */
            } else if (typeof (headers) === 'string') {
                s += headers.trimRight();
            } else {
                s += Object.keys(headers).map(
                    function (h) { return h + ': ' + headers[h]; }).join('\n');
            }
            if (res.body !== undefined) {
                var body = (typeof (res.body) === 'object'
                    ? JSON.stringify(res.body, null, 2) : res.body);
                if (body.length > 0) { s += '\n\n' + body };
                delete res.body;
            } else {
                s = s.trimRight();
            }
            if (res.trailer) {
                s += '\n' + res.trailer;
            }
            delete res.trailer;
            if (s) {
                details.push(_this.indent(s));
            }
            // E.g. for extra 'foo' field on 'res', add 'res.foo' at
            // top-level. This *does* have the potential to stomp on a
            // literal 'res.foo' key.
            Object.keys(res).forEach(function (k) {
                rec['res.' + k] = res[k];
            });
        }

        if (rec.res && typeof (rec.res) === 'object') {
            _res(rec.res);
            delete rec.res;
        }
        if (rec.client_res && typeof (rec.client_res) === 'object') {
            _res(rec.client_res);
            delete rec.client_res;
        }

        if (rec.err && rec.err.stack) {
            var err = rec.err
            if (typeof (err.stack) !== 'string') {
                details.push(this.indent(err.stack.toString()));
            } else {
                details.push(this.indent(err.stack));
            }
            delete err.message;
            delete err.name;
            delete err.stack;
            // E.g. for extra 'foo' field on 'err', add 'err.foo' at
            // top-level. This *does* have the potential to stomp on a
            // literal 'err.foo' key.
            Object.keys(err).forEach(function (k) {
                rec['err.' + k] = err[k];
            })
            delete rec.err;
        }

        var leftover = Object.keys(rec);
        for (var i = 0; i < leftover.length; i++) {
            var key = leftover[i];
            var value = rec[key];
            var stringified = false;
            if (typeof (value) !== 'string') {
                value = JSON.stringify(value, null, 2);
                stringified = true;
            }
            if (value.indexOf('\n') !== -1 || value.length > 50) {
                details.push(this.indent(key + ': ' + value));
            } else if (!stringified && (value.indexOf(' ') != -1 ||
                value.length === 0))
            {
                extras.push(key + '=' + JSON.stringify(value));
            } else {
                extras.push(key + '=' + value);
            }
        }

        extras = this.stylize(
            (extras.length ? ' (' + extras.join(', ') + ')' : ''), 'XXX');
        details = this.stylize(
            (details.length ? details.join('\n    --\n') + '\n' : ''), 'XXX');
        if (!short)
            retval = this.format('%s %s: %s on %s%s:%s%s\n%s',
                time,
                level,
                nameStr,
                hostname || '<no-hostname>',
                src,
                onelineMsg,
                extras,
                details);
        else
            retval = this.format('%s %s %s:%s%s\n%s',
                time,
                level,
                nameStr,
                onelineMsg,
                extras,
                details);
        break;

    case this.OM_INSPECT:
        retval = (util.inspect(rec, false, Infinity, true));
        break;

    case this.OM_BUNYAN:
        retval = (JSON.stringify(rec, null, 0));
        break;

    case this.OM_JSON:
        retval = (JSON.stringify(rec, null, opts.jsonIndent));
        break;

    case this.OM_SIMPLE:
        /* JSSTYLED */
        // <http://logging.apache.org/log4j/1.2/apidocs/org/apache/log4j/SimpleLayout.html>
        if (!this.isValidRecord(rec)) {
            retval = line;
        }else {
            retval = (this.format('%s - %s\n',
                this.upperNameFromLevel[rec.level] || 'LVL' + rec.level,
                rec.msg));
        }
        break;
    default:
        throw new Error('unknown output mode: '+opts.outputMode);
    }
    
    return retval;
};

Bunyan.prototype.indent = function(s) {
    return '    ' + s.split(/\r?\n/).join('\n    ');
};

Bunyan.prototype.stylize = function(str, color) {
    var opts = this.opts;

    if (!str)
        return '';

    var codes = this[opts.colorMode + 'Colors'][color];
    if(codes && opts.colorMode == 'ANSI') {
        return '\033[' + codes[0] + 'm' + str +
                     '\033[' + codes[1] + 'm';
    }else if(codes && opts.colorMode == 'HTML') {
        return codes[0] + str + codes[1];
    }else {
        return str;
    }
};

Bunyan.prototype.objCopy = function(obj) {
    if (obj === null) {
        return null;
    } else if (Array.isArray(obj)) {
        return obj.slice();
    } else {
        var copy = {};
        Object.keys(obj).forEach(function (k) {
            copy[k] = obj[k];
        });
        return copy;
    }
};
module.exports = Bunyan;
