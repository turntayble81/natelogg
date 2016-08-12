var socket          = io();
var historyLength   = 0;
var maxHistoryLines = 1000;
var storage         = {};
var shell;

$(document).ready(function() {
    shell = $('#shell');

    $('#logs input:checkbox').each(function(idx, el) {
        el = $(el);
        el.prop('checked', false);
    });

    $(window).on('beforeunload', function() {
        //save selected to logs to local storage
        storage.setItem('logSelection', getLogSelection());
        return 'Stop logging and exit?';
    });
    
    function getLogSelection() {
        var checkedLogs = {};
        
        $('#logs input:checkbox').each(function(i, checkbox) {
            if (checkbox.checked) {
                checkedLogs[checkbox.value] = true;                                
            }
        });
        
        return checkedLogs;
    }    

    $('#font-size').change(function() {
        storage.setItem('fontSize', this.value);
        shell.css('font-size', this.value + 'px');
    });

    $('#max-history-lines').change(function() {
        var val = parseInt(this.value);
        storage.setItem('maxHistoryLines', this.value);
        maxHistoryLines = val;
    });

    $('#logs input:checkbox, #logs .log-label').click(function() {
        var el         = $(this);
        
        if (!el.is('input:checkbox')) {
            el = el.prev().find('input:checkbox');
            el.prop('checked', !el.prop('checked'));
        }
        
        var checked    = el.prop('checked');
        var log        = el.attr('value');
        
        toggleLog(log, checked);               
    });

    $('#clear-history').click(function() {
        shell.html('');
        historyLength = 0;
    });

    $('input[name=formatter]').change(function() {
        var formatter = $(this).val();

        storage.setItem('formatter', formatter);
        socket.emit('setFormatter', {
            formatter: formatter
        });
    });

    $('#bunyan-options').click(function() {
        var win = $('#bunyan-options-window');
        if(win.dialog('isOpen')) {
            win.dialog('close');
        }else {
            win.dialog('open');
        }
    });

    $('#bunyan-options-window').dialog({
        autoOpen: false,
        dialogClass: 'noTitleStuff',
        position: { my: "left top", at: "left bottom", of: '#bunyan-options' },
        height: 260,
        width: 300,
        buttons: [{
            text: 'Save',
            click: function() {
                var val = $(this).find('textarea').val();
                socket.emit('setFormatterOptions', {
                    formatter : 'bunyan',
                    options   : val
                });
                $(this).dialog( "close" );
            }
        }, {
            text: 'Cancel',
            click: function() {
                $(this).dialog( "close" );
            }
        }]
    }).dialog("widget").find(".ui-dialog-titlebar").hide();

    if(storage.getItem('fontSize')) {
        $('#font-size').val(storage.getItem('fontSize')).change();
    }

    if(storage.getItem('maxHistoryLines')) {
        $('#max-history-lines').val(storage.getItem('maxHistoryLines')).change();
    }

    if(storage.getItem('formatter')) {
        $('input[name=formatter][value=' + storage.getItem('formatter') + ']').prop('checked', true).change();
    }
    
    applyPreviousLogSelection();
});


socket.on('logData', function(data) {
    var el = shell.get(0);
    var scrollAtBottom = (el.scrollHeight == (el.offsetHeight + el.scrollTop)) ? true : false;
    var pre = document.createElement('pre');
    var removeLength;
    var n;

    if(historyLength >= maxHistoryLines) {
        removeLength = historyLength - maxHistoryLines;
        for(n=0; n<=removeLength; n++) {
            el.removeChild(el.children[0]);
            historyLength--;
        }
    }
    pre.innerHTML=data;
    el.appendChild(pre);
    historyLength++;

    if(scrollAtBottom) {
        el.scrollTop = el.scrollHeight;
    }
});

if(typeof(Storage) !== "undefined") {
    storage.setItem    = function(key, val) {
        if(typeof(val) == 'object') {
            val = JSON.stringify(val);
        }
        localStorage.setItem(key, val);
    }
    storage.getItem    = function(key, val) {
        var val = localStorage.getItem(key, val);
        if (val) {
            try {
                return JSON.parse(val)
            } catch(err) {
                return val
            }
        }     
    };
    storage.removeItem = function(key) {
        localStorage.removeItem(key);
    };
}else {
    storage.setItem    = function() {};
    storage.getItem    = function() {};
    storage.removeItem = function() {};
}

function applyPreviousLogSelection() {
    var logSelection = storage.getItem('logSelection');
    
    Object.keys(logSelection).forEach(function(key) {
       $('#logs input:checkbox[value="' + key + '"]').prop('checked', true);
       toggleLog(key, true);
    });
    
    storage.removeItem('logSelection');
}

function toggleLog(log, checked) {
    socket.emit('toggleLog', {
        log     : log,
        enabled : checked
    }); 
}