var ACCNAME = "modulbank",
		APPNAME = "queue";	
	
	function log(str) {
		console.log(str);
		// var log = $("#log").html();
		// log += str+"<br>";
		// $('#log').html(log);
	}

	function setCookie(cname, cvalue, exdays) {
	    var d = new Date();
	    d.setTime(d.getTime() + (exdays*24*60*60*1000));
	    var expires = "expires="+d.toGMTString();
	    document.cookie = cname + "=" + cvalue + "; " + expires + "; path=/";
	}

	function getCookie(cname) {
	    var name = cname + "=";
	    var ca = document.cookie.split(';');
	    for(var i=0; i<ca.length; i++) {
	        var c = ca[i];
	        while (c.charAt(0)==' ') c = c.substring(1);
	        if (c.indexOf(name) != -1) return c.substring(name.length,c.length);
	    }
	    return "";
	}

	function deleteCookie(cname) {
		document.cookie = cname+"=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
	}

	function getHashParams() {

	    var hashParams = {};
	    var e,
	        a = /\+/g,  // Regex for replacing addition symbol with a space
	        r = /([^&;=]+)=?([^&;]*)/g,
	        d = function (s) { return decodeURIComponent(s.replace(a, " ")); },
	        q = window.location.hash.substring(1);

	    while (e = r.exec(q))
	       hashParams[d(e[1])] = d(e[2]);

	    return hashParams;
	}


	var voxAPI = VoxImplant.getInstance(),
		currentCall = null,
		outboundCall = null,
		inboundCall = null,
		currentACDstatus = null;

	voxAPI.addEventListener(VoxImplant.Events.SDKReady, onSdkReady);
	voxAPI.addEventListener(VoxImplant.Events.ConnectionEstablished, onConnectionEstablished);
	voxAPI.addEventListener(VoxImplant.Events.ConnectionFailed, onConnectionFailed);
	voxAPI.addEventListener(VoxImplant.Events.ConnectionClosed, onConnectionClosed);
	voxAPI.addEventListener(VoxImplant.Events.AuthResult, onAuthResult);
	voxAPI.addEventListener(VoxImplant.Events.IncomingCall, onIncomingCall);
	voxAPI.addEventListener(VoxImplant.Events.MicAccessResult, onMicAccessResult);
	voxAPI.addEventListener(VoxImplant.Events.SourcesInfoUpdated, onSourcesInfoUpdated);

	voxAPI.init({ micRequired: true, progressTone: true });

	function onSdkReady(){
		log("onSDKReady");
		connect();
	}
	
	function onConnectionEstablished() {
		log("Connection established: "+voxAPI.connected());
		$('div.spinner').addClass('hidden');
		$('div.container').removeClass('hidden');
		if (getCookie('login') != "" && getCookie('password') != "") {
			$('input[type=login]').val(getCookie('login'));  
			$('input[type=password]').val(getCookie('password'));
			$('div.checkbox input[type=checkbox]').prop('checked', true);
		}
	}
	
	function onConnectionFailed() {
		log("Connection failed");
		setTimeout(function() {voxAPI.connect();}, 5000);
	}
	function onConnectionClosed() {
		log("Connection closed");
		voxAPI.connect();
		$('div.spinner').removeClass('hidden');
		$('div.container').addClass('hidden');
		$('div.panel').addClass('hidden');
	}
	
	function onAuthResult(e) {
		log("AuthResult: "+e.result);
		if (e.result) {
			log("Auth success");
			if ($('div.checkbox input[type=checkbox]').is(':checked')) {
				setCookie('login', $('input[type=login]').val(), 10);
				setCookie('password', $('input[type=password]').val(), 10);
			} else {
				deleteCookie('login');
				deleteCookie('password');
			}
			$('div.container').addClass('hidden');
			$('div.panel').removeClass('hidden');
			voxAPI.setOperatorACDStatus(VoxImplant.OperatorACDStatuses.Online);
			$('button[value=ONLINE]').removeClass('btn-default').addClass('active btn-primary');
			$('div[data-toggle-name=acd_state] button').click(function () {
                setACDstatus($(this).val());
            });
		} else {
			log("Auth failed");			
			$('#signin div.alert').removeClass('hidden');
		}
	}
	
	function onCallConnected(e) {					
		log("CallConnected: "+currentCall.id());
		setACDstatus(VoxImplant.OperatorACDStatuses.InService);
		$('#controlButton').removeClass('btn-success').addClass('btn-danger').html('Disconnect');
		$('#controlButton').unbind('click').click(function(event){
			disconnectCall();
		});	
	}
	
	function onCallDisconnected(e) {
		$('#incomingCallModal').modal('hide');
		log("CallDisconnected: "+currentCall.id()+" Call state: "+currentCall.state());
		if (currentACDstatus == VoxImplant.OperatorACDStatuses.InService) setACDstatus(VoxImplant.OperatorACDStatuses.AfterService);
		currentCall = null;
		$('#controlButton').removeClass('btn-danger').addClass('btn-success').html('Call');
		$('#controlButton').unbind('click').click(function(event){
			createCall();
		});	
	}
	
	function onCallFailed(e) {
		if (inboundCall != null) $('#inbound_call').slideUp();
		log("CallFailed: "+currentCall.id()+" code: "+e.code+" reason: "+e.reason);
	}

	function handleDeviceSelected() {
		voxAPI.useAudioSource(document.getElementById("audioRecordingDevice").value);
	}

	function onSourcesInfoUpdated() {
		var audioSources = voxAPI.audioSources();
		// audioSources[i] . id / name
	}
	
	function onMicAccessResult(e) {			
		log("Mic Access Allowed: "+e.result);
	}
	
	function onIncomingCall(e) {
		inboundCall = currentCall = e.call;
		currentCall.addEventListener(VoxImplant.CallEvents.Connected, onCallConnected);
		currentCall.addEventListener(VoxImplant.CallEvents.Disconnected, onCallDisconnected);
		currentCall.addEventListener(VoxImplant.CallEvents.Failed, onCallFailed);
		$('#caller').html(e.call.number());
		log("Incoming call from: "+e.call.number());
		$('#incomingCallModal').modal();
	}
	
	function connect() {
		log("Establishing connection...");
		voxAPI.connect();
	}	
	
	function createCall() {
		log("Calling to "+document.getElementById('phonenum').value);
		outboundCall = currentCall = voxAPI.call(document.getElementById('phonenum').value, true);
		currentCall.addEventListener(VoxImplant.CallEvents.Connected, onCallConnected);
		currentCall.addEventListener(VoxImplant.CallEvents.Disconnected, onCallDisconnected);
		currentCall.addEventListener(VoxImplant.CallEvents.Failed, onCallFailed);		
		log("Calls num: "+voxAPI.calls.length);
		$('#controlButton').removeClass('btn-success').addClass('btn-danger').html('Cancel');
		$('#controlButton').unbind('click').click(function(event){
			disconnectCall();
		});
	}
	
	function disconnectCall() {
		if (currentCall != null) {
			log("Disconnect");
			currentCall.hangup();
		}
	}
	
	function muteSnd() {
		currentCall.mutePlayback();
	}
	
	function unmuteSnd() {
		currentCall.unmutePlayback();
	}
	
	function muteMic() {
		currentCall.muteMicrophone();
	}
	
	function unmuteMic() {
		currentCall.unmuteMicrophone();
	}

	function sendDTMF(key) {
		if (currentCall != null) currentCall.sendTone(key);
	}

	function setACDstatus(status) {
		voxAPI.setOperatorACDStatus(status);
		$('div[data-toggle-name=acd_state] button').addClass('btn-default').removeClass('active btn-primary btn-success btn-info btn-warning btn-danger');
	    $('button[value='+status+']').removeClass('btn-default').addClass('active');

		switch (status) {
			case VoxImplant.OperatorACDStatuses.Online:
				$('button[value='+status+']').addClass('btn-primary');
			break;
			case VoxImplant.OperatorACDStatuses.Ready:
				$('button[value='+status+']').addClass('btn-success');
			break;
			case VoxImplant.OperatorACDStatuses.InService:
				$('button[value='+status+']').addClass('btn-info');
			break;
			case VoxImplant.OperatorACDStatuses.AfterService:
				$('button[value='+status+']').addClass('btn-warning');
			break;
			case VoxImplant.OperatorACDStatuses.DND:
				$('button[value='+status+']').addClass('btn-danger');
			break;
		}
		currentACDstatus = status;
		log('Current operator state: '+status);
	}

	function acceptCall() {
		if (currentCall != null) currentCall.answer();
	}

	function rejectCall() {
		if (currentCall != null) currentCall.reject();
	}

	$(document).ready(function(){

		$('#signin').submit(function(event){
			if (!$('#signin div.alert').hasClass('hidden')) $('#signin div.alert').addClass('hidden');
			var username = $('input[type=login]').val()+"@"+APPNAME+"."+ACCNAME+".voximplant.com",
				pwd = $('input[type=password]').val();
			log("Authorizing user "+username+" ...");
			voxAPI.login(username, pwd);
			event.preventDefault();	
		});

		$('div.row.keypad button').click(function(event){
			sendDTMF($(this).val());
		});

		$('#answerBtn').click(function(event){
			$('#incomingCallModal').modal('hide');
			acceptCall();
			event.stopPropagation();
		});
		$('#rejectBtn').click(function(event){rejectCall();});
		$('#controlButton').click(function(event){createCall();});

	});