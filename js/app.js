
/**
 * Copyright 2011, Deft Labs.
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at:
 * 
 * http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
*/

var currentServerStatus = [];
var previousServerStatus = [];
var selectedHostId = null;
var serverStatusInterval = null;

$.base64.is_unicode = true;

/**
 * Start the app/main.
 */
function runApp() {
    
    var hosts = loadHosts();
    selectedHostId = getPersistedItem('selectedHost');

    if (hosts.length > 1) {

        var hostOptions = $('#hostSelect').attr('options');
        var foundSelected = false;
        for (var idx in hosts) {
            var host = hosts[idx];
            var hostId = assembleHostId(host);
            if (selectedHostId == hostId) foundSelected = true;
            hostOptions[idx] = new Option(hostId, hostId);
        }

        if (foundSelected) $('#hostSelect').val(selectedHostId);

        $('#hostSelect').change(function() {
            var hostId =  $('#hostSelect option:selected').val();
            selectedHostId = hostId;
            persistItem("selectedHost", selectedHostId);
            startServerStatusPoll();
        });

        $('#hostSelectContainer').show();

    } else {

        if (hosts.length == 1) {
            // Set the current to first record.
            selectedHostId = hosts[0][0] + ':' + hosts[0][1];
            persistItem("selectedHost", selectedHostId);
        } else {
            // No hosts in the system. 
            $('#statusMsgContainer').html('No servers configured. Add a server in options.');
            $('#statusMsgContainer').show();
        }
    }

    startServerStatusPoll();

    createChart('opcounters', 'query', 'opcountersQueryChart', 'rgba(57, 20, 175, 1)', 'rgba(57, 20, 175, 0)', true);
    createChart('opcounters', 'insert', 'opcountersInsertChart', 'rgba(135, 110, 215, 1)', 'rgba(135, 110, 215, 0)', true);
    createChart('opcounters', 'update', 'opcountersUpdateChart', 'rgba 64, 171, 1)', 'rgba(18, 64, 171, 0)', true);
    createChart('opcounters', 'delete', 'opcountersDeleteChart', 'rgba(255, 231, 115, 1)', 'rgba(255, 231, 115, 0)', true);
    createChart('opcounters', 'command', 'opcountersCommandChart', 'rgba(255, 128, 64, 1)', 'rgba(255, 128, 64, 0)', true);
    createChart('opcounters', 'getmore', 'opcountersGetmoreChart', 'rgba(191, 96, 48, 1)', 'rgba(191, 96, 48, 0)', true);
    createChart('connections', 'current', 'connectionsCurrentChart', 'rgba(255, 255, 0, 1)', 'rgba(255, 255, 0, 0)', false);
    createChart('extra_info', 'page_faults', 'pageFaultsChart', 'rgba(185, 247, 62, 1)', 'rgba(185, 247, 62, 0)', true);
    createChart('backgroundFlushing', 'flushes', 'flushesChart', 'rgba(166, 137, 0, 1)', 'rgba(166, 137, 0, 0)', true);
    createPercentChart('lockedPercentChart', 'rgba(191, 191, 48, 1)', 'rgba(191, 191, 48, 0)', 'globalLock', 'totalTime', 'globalLock', 'lockTime');
    createPercentChart('idxMissPercentChart', 'rgba(166, 75, 0, 1)', 'rgba(166, 75, 0, 0)', 'indexCounters', 'btree.accesses', 'indexCounters', 'btree.misses');
    createChart('mem', 'mapped', 'memMappedChart', 'rgba(255, 116, 0, 1)', 'rgba(255, 116, 0, 0)', false);
    createChart('network', 'bytesIn', 'netInChart', 'rgba(255, 128, 64, 1)', 'rgba(255, 128, 64, 0)', true);
    createChart('network', 'bytesOut', 'netOutChart', 'rgba(191, 96, 48, 1)', 'rgba(191, 96, 48, 0)', true);

};

/**
 * Setup the options page.
 */
function runOptions() {

    $("#addHost").button();

    $("#addHostSubmit").button();

    $('#addHostSubmit').click(function(event) {
        event.preventDefault();

        //$('#addHostSubmit').attr('disabled', 'disabled');
        $('#addHostInvalidHostnameMsg').hide();
        $('#addHostInvalidHostPortMsg').hide();
        $('#addHostDuplicateHostMsg').hide();

         var hostname = $('#hostname').val();
         var port = $('#port').val();
         var username = $('#u').val();
         var password = $('#p').val();
         var hostId = $('#hostId').val();

         var isAdd = $('#isAdd').val();

         if (!hostname || hostname == '') {
             $('#addHostInvalidHostnameMsg').show('fast'); 
             return;
         };

        if (!isInt(port)) {
            $('#addHostInvalidHostPortMsg').show('fast'); 
             return;
        }

        if (!username || username == null) username = '';
        
        if (!password || password == null) password = '';
        else password = $.base64.encode(password);

        port = parseInt(port, 10);

        // We are either editing or adding.
        if (isAdd && isAdd == 'true') {

            var newHost = [];
            newHost.push(hostname);
            newHost.push(port);
            newHost.push(username);
            newHost.push(password);

            var hosts = loadHosts();

            // Look for a duplicate.
            for (var idx in hosts) {
                var host = hosts[idx];
                if (host[0] == hostname && host[1] == port) {
                    $('#addHostDuplicateHostMsg').show('fast'); 
                    return;
                }
            }

            hosts.push(newHost);
            persistItem('hosts', hosts);

            if (!password || password == null) newHost[3] = '';
            else newHost[3] = '&#149;&#149;&#149;&#149;&#149;&#149;&#149;&#149;';

            addTableEditControls(newHost);

            // Add the row to the table.
            $('#hostsTable').dataTable().fnAddData(newHost);

        } else {
            // We are dealing with an edit.
            var hosts = loadHosts();

            for (var idx in hosts) {
                var host = hosts[idx];
                var hid = assembleHostId(host);
                if (hostId == hid) {
                    host[0] = hostname;
                    host[1] = port;
                    host[2] = username;
                    host[3] = password;

                    // Make sure the old host is not the selected value.
                    var storedSelectedId = getPersistedItem('selectedHost');
                    if (storedSelectedId == hostId) {
                        var newSelectedHostId = assembleHostId(host);
                        persistItem("selectedHost", newSelectedHostId);
                        selectedHostId = newSelectedHostId;
                        startServerStatusPoll();
                    }

                    break;
                }
            }
            
            persistItem('hosts', hosts);

            window.location.reload(false);
        }

        $("#addHostContainer").dialog("close");
    });

    $('#addHost').click(function() { launchEditHostContainer('127.0.0.1', 28017, '', '', 'Add Host', true, null); });

    var hosts = loadHosts();

    for (var idx in hosts) {
        var host = hosts[idx];
        if (host[3] && host[3] != null && host[3] != '') {
            host[3] = '&#149;&#149;&#149;&#149;&#149;&#149;&#149;&#149;';
        }

        var hostId = assembleHostId(host);

        addTableEditControls(host);
    }

    $('#hostsTable').dataTable( { 
        'bProcessing': false, 
        'bJQueryUI': true, 
        "aaData": hosts, 
        'sPaginationType': 'full_numbers', 
        'iDisplayLength': 50, 
        'bLengthChange': false,
        "aoColumns": [
            { "bSortable": true, "sWidth": "50%" },
            { "bSortable": true, "sWidth": "10%" },
            { "bSortable": true, "sWidth": "20%" },
            { "bSortable": false, "sWidth": "10%" },
            { "bSortable": false, "sWidth": "10%" }
        ]
    });
};

/**
 * Edit the host.
 */
function editHost(hostId) {
    var host = findHost(hostId);
    // Get out of here if the host is missing.
    if (host == null) { window.location.reload(false); return; }
    launchEditHostContainer(host[0], host[1], host[2], host[3], 'Edit Host', false, hostId); 
};

/**
 * Delete the host.
 */
function deleteHost(hostId) {
    var hosts = loadHosts();
    var newHosts = [];

    for (var idx in hosts) {
        var host = hosts[idx];
        var hid = assembleHostId(host);
        if (hostId == hid) {
            // Make sure the old host is not the selected value.
            var storedSelectedId = getPersistedItem('selectedHost');
            if (storedSelectedId == hostId) {
                stopServerStatusPoll();
                removeItem('selectedHost');
            }
        } else { newHosts.push(host); }
    }

    persistItem('hosts', newHosts);

    window.location.reload(false);
};

function launchEditHostContainer(hostname, port, username, password, title, isAdd, hostId) {
    $('#addHostInvalidHostnameMsg').hide();
    $('#addHostInvalidHostPortMsg').hide();
    $('#addHostDuplicateHostMsg').hide();
 
    $('#hostname').val(hostname);
    $('#port').val(port);
    $('#u').val(username);
    $('#p').val(password);
    $('#isAdd').val(isAdd);
    
    if (hostId && hostId != null) $('#hostId').val(hostId);

    $("#addHostContainer").dialog({ height: 390, width: 410, modal: true, title: title, resizable: false, stack: true, show: 'fade', hide: 'fade' });
};

/**
 * Stop the server status poll.
 */
function stopServerStatusPoll() { if (serverStatusInterval) clearInterval(serverStatusInterval); };

/**
 * Start the interval lookup for server status.
 */
function startServerStatusPoll() {

    stopServerStatusPoll();

    var hosts = loadHosts();

    if (!selectedHostId) {
        for (var idx in hosts) {
            selectedHostId = assembleHostId(hosts[idx]);
            persistItem("selectedHost", selectedHostId);
            break;
        }
    }

    if (!selectedHostId) return;

    var selectedHost = parseHostId(selectedHostId);
    
    var host = null;

    for (var idx in hosts) {
        host = hosts[idx];
        if (host[0] == selectedHost[0] && host[1] == selectedHost[1]) break;
    }

    if (host == null) return; 

    serverStatusInterval = setInterval(function() {
        queryServerStatus(host, function(response) { 
            previousServerStatus = currentServerStatus;
            currentServerStatus = response;
        });
    }, 1000);
};

/**
 * Returns the value or undefined if not found.
 */
function extractServerStatusValue(serverStatus, group, identity) {
    var groupObj = serverStatus[group];

    if (!groupObj) return undefined;
    if (identity.indexOf('.') == -1) return groupObj[identity];

    // We are dealing with a nested object. 
    var nestedGroupName = identity.substring(0, identity.indexOf('.'));
    var nestedIdentityName = identity.substring(identity.indexOf('.')+1, identity.length);

    var nestedGroupObj = groupObj[nestedGroupName];
    if (!nestedGroupObj) return undefined;

    return nestedGroupObj[nestedIdentityName];
};

/**
 * Add a server status value to a series for a group/identity.
 */
function addServerStatusValueToSeries(series, group, identity, isCounter) {
    var x = (new Date()).getTime();

    var currentValue = extractServerStatusValue(currentServerStatus, group, identity);
    
    var y = 0;
    if (isCounter) {
        var previousValue = extractServerStatusValue(previousServerStatus, group, identity);
   
        if (currentValue && previousValue && (currentValue > previousValue)) {
            y = currentValue - previousValue;
        }
    } else { y = currentValue; }
    series.append(x, y);
};

/**
 * Add a server status value to a series for a group/identity.
 */
function addPercentToTimeSeries(series, group1, identity1, group2, identity2) {
    var x = (new Date()).getTime();

    var current1 = extractServerStatusValue(currentServerStatus, group1, identity1);
    var current2 = extractServerStatusValue(currentServerStatus, group2, identity2);

    var previous1 = extractServerStatusValue(previousServerStatus, group1, identity1);
    var previous2 = extractServerStatusValue(previousServerStatus, group2, identity2);
    
    var y = 0;

    var x1 = previous2 - current2;
    var y1 = previous1 - current1;

    if (y1 != 0) { y = (((x1 / y1) * 1000) / 10); }

    series.append(x, y);
};

/**
 * Create the lock percentage chart.
 */
function createPercentChart(divId, lineColor, fillColor, group1, identity1, group2, identity2) {
    var series = new TimeSeries();
    setInterval(function() { addPercentToTimeSeries(series, group1, identity1, group2, identity2); }, 1000);

    var chart = new SmoothieChart({ millisPerPixel: 200, grid: { strokeStyle: '#555555', fillStyle: '#402817',  lineWidth: 1, millisPerLine: 10000, verticalSections: 4 }});
    chart.addTimeSeries(series, { strokeStyle: lineColor, fillStyle: fillColor, lineWidth: 3 });
    chart.streamTo(document.getElementById(divId), 1000);
};

/**
 * Create a chart with a single time series.
 */
function createChart(group, identity, divId, lineColor, fillColor, isCounter) {
    var series = new TimeSeries();
    
    setInterval(function() { addServerStatusValueToSeries(series, group, identity, isCounter); }, 1000);

    var chart = new SmoothieChart({ millisPerPixel: 200, grid: { strokeStyle: '#555555', fillStyle: '#402817',  lineWidth: 1, millisPerLine: 10000, verticalSections: 4 }});
    chart.addTimeSeries(series, { strokeStyle: lineColor, fillStyle: fillColor, lineWidth: 3 });
    chart.streamTo(document.getElementById(divId), 1000);
};

function queryServerStatus(host, success, failure, cmdError, notFound, serverError) {
    queryDb(('http://' + host[0] + ':' + host[1] + '/serverStatus'), host[2], host[3], success, failure, cmdError, notFound, serverError);
};

function queryDb(commandUrl, username, password, success, failure, cmdError, notFound, serverError) {

    var xhr = new XMLHttpRequest();
    if (username && username != null && username != '') {
        xhr.open("GET", commandUrl, true, username, $.base64.decode(password));
    } else { xhr.open("GET", commandUrl, true); }

    xhr.onreadystatechange = function() {

        if (xhr.readyState == 4 && xhr.status == 200) {
            authProblem = false;
            $('#statusMsgContainer').hide();
            
            var resp = JSON.parse(fixDateFields(xhr.responseText));
            
            // TODO: Check for mongo error state in response json

            success(resp);
        } else if (xhr.readyState == 4 && xhr.status == 404) {
            if (notFound) notFound();

        } else if (xhr.readyState == 4 && xhr.status == 0) {
            // The client is not able to connect to the server. Display error message.
            $('#statusMsgContainer').html('Unable to connect to server: ' + commandUrl);
            $('#statusMsgContainer').show();

        } else if (xhr.readyState == 4 && xhr.status != 200) {
            if (serverError) serverError(xhr.readyState, xhr.status);
            if (failure) failure(xhr.readyState, xhr.status);
        } 
    }
    xhr.send();
};

/**
 * There is a date format bug in some older versions of Mongo. Thanks to Lucas for 
 * submitting part of the regex solution :-)
 *
 * The regex below replaces the date fields with 0 (since they are not used).
 *
 * http://jira.mongodb.org/browse/SERVER-2378
 * 
 * The old format is:
 * "last_finished" : Date( 1295450058854 ) 
 * The date format in newer releases is:
 * "localTime" : { "$date" : 1295452287356 }
 */
function fixDateFields(resp) { return resp.replace(/Date\( (\d+) \)/g, "0"); };

function isInt(v) {
    var regex = /(^-?\d\d*$)/;
    return regex.test(v);
};

/**
 * Parse the host id.
 */
function parseHostId(hostId) { return hostId.split(":"); };

/**
 * Assemble the host id.
 */
function assembleHostId(host) { return baseAssembleHostId(host[0], host[1]); };

/**
 * Assemble the host based on hostname and port.
 */
function baseAssembleHostId(hostname, port) { return hostname + ':' + port; };

/**
 * Add the host edit controls (in the table).
 */
function addTableEditControls(host) {
    var hostId = assembleHostId(host);

    host.push('<div class="hostEditIcons"><span class="ui-icon ui-icon-trash" onclick="deleteHost(\'' + hostId + '\')"></span>&nbsp;&nbsp;<span class="ui-icon ui-icon-pencil" onclick="editHost(\'' + hostId + '\')"></span</div>');
};
 
/**
 * Load the persisted hosts. Load the data from local storage and create the table (if missing).
 */
function loadHosts() {
    var hosts = getPersistedItem('hosts');
    if (!hosts) {
        hosts = [ [ '127.0.0.1', '28017', '', '' ] ]
        persistItem('hosts', hosts);
    }

    return hosts;
};

function findHost(hostId) {

    var hosts = loadHosts();

    for (var idx in hosts) {
        var host = hosts[idx];
        var hid = assembleHostId(host);
        if (hostId == hid) return host;
    }

    return null;
};

function getPersistedItem(key) {
    var value;
    try { value = window.localStorage.getItem(key);
    } catch(e) { value = null; }
    if (value) return JSON.parse(value);
    return null;
};

function persistItem(key, value) {
    window.localStorage.setItem(key, JSON.stringify(value));
};

function removeItem(key) { window.localStorage.removeItem(key); };

