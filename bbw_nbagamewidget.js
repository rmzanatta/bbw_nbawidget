/* NBA Game Widget for BaselineBums forum
 * Copyright (c) 2025. All rights reserved.
 * 
 * This code is proprietary and may not be copied, distributed, or modified
 * without explicit written permission from the copyright holder.
 * This code is made publicly visible for transparency purposes only.
 * 
 * No permission is granted to use, copy, modify, merge, publish, distribute, 
 * sublicense, and/or sell copies of this software without explicit written 
 * permission from the copyright holder.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
*/

/* NBA Game Widget Class 
Globally Manages the NBA Game Widget
*/
class NBAGameWidget {
    constructor(pstrWidgetDiv, pstrStorageNamespace, pstrGameDetailIDType, pstrGameDetailID, pstrPrimaryTeam,pblnDebugMode = false) {
        //*** Set Debug Mode */
        this.blnDebugMode = pblnDebugMode

        //*** Set Widget Data */
        this.blnDataLoaded = false;
        this.strWidgetDiv = pstrWidgetDiv;
        this.strPrimaryTeam = pstrPrimaryTeam;
        this.strActiveTab = "summary";
        this.strBoxScorePrimaryOrSecondary = "primary";
        this.strBoxScoreFullOrCompact = "compact";
        this.strBoxScoreFullOrCompactOverride = "";

		//*** Setup Interactive Elements (these are tags that require event handling)
		this.tabSummary = null;
		this.tabBoxScore = null;
        this.tabTeams = null;
        this.tabInjury = null;
		this.selectBoxScoreTeam = null;
		this.selectBoxScoreStyle = null;

        //*** Set Game Info Data */
        this.strGameDetailIDType = pstrGameDetailIDType;
        this.strGameDetailID = pstrGameDetailID

        //*** Initialize Game Header Data */
        this.dtmGameDate = null;
        this.strGameStatus = "";
        this.strGameStatusDetail = "";
        this.blnLiveGame = false;
        this.blnHasStarted = false;

        //*** Initialize Venue Data */
        this.strCityName = "";
        this.strVenueName = "";
        this.strAttendance = "";

        //*** Initialize Team Class */
        this.objHomeTeam = new TeamStats();
        this.objAwayTeam = new TeamStats();

        //*** Initialize Helper Classes
        this.objAPIManager = new APIManager();
        this.objAPIManager.procSetDebugMode(pblnDebugMode);
        this.objDataManager = new StorageManager(pstrStorageNamespace);
        this.objDataManager.procSetDebugMode(pblnDebugMode);
    }

    //*** Check if Widget is allowed to run */
    funcAllowWidgetRun() {
        //*** Only allow running within baselinebums if the data-logged-in element is true for logged in users */
        const blnIsLoggedIn = document.documentElement.getAttribute('data-logged-in');
        return blnIsLoggedIn === 'true';
    }

    //*** Load Game Data */
    async procLoadGameData() {
        //*** Reset Data Loaded Flag */
        this.blnDataLoaded = false;

        //*** Load Game Data */
        if(this.funcAllowWidgetRun()) {
            let jsonGameData = null;
            switch (this.strGameDetailIDType.toLowerCase()) {
                case "espn":
                    jsonGameData = await this.funcGetGameDetailESPN(this.strGameDetailID);
                    this.procParseGameDataESPN(jsonGameData)
                    break;
                default:
                    console.error(`NBAGameWidget - Unknown Game ID Type for data fetch: ${this.strGameDetailIDType}`);
                    return null;
            }
        }
    }

    // Get Game Detail from ESPN
    async funcGetGameDetailESPN(pstrEventId) {
        //*** Build API Url
        const strUrl = `https://site.web.api.espn.com/apis/site/v2/sports/basketball/nba/summary?region=us&lang=en&contentorigin=espn&event=${pstrEventId}`;

        //*** Fetch data using API manager
        if (this.blnDebugMode) { console.log(`NBAGameWidget - Begin Fetch ESPN Game Detail: ${strUrl}`); }
        const jsonRawJSON = await this.objAPIManager.funcGetAPIData(strUrl, "json");

        //*** Return Results
        if (this.blnDebugMode) { console.log(`NBAGameWidget - Finish Fetch ESPN Game Detail: ${strUrl}`); }
        return jsonRawJSON;
    }

    //*** Process Data ESPN */
    procParseGameDataESPN(pjsonGameData) {
        //*** Get competition object
        const objCompetition = pjsonGameData.header.competitions[0];

        //*** Extract game date
        this.dtmGameDate = new Date(objCompetition.date);

        //*** Extract game status
        this.strGameStatus = objCompetition.status.type.description;
        this.strGameStatusDetail = objCompetition.status.type.detail;

        //*** Set Live Game Flag
        const arrLiveStatuses = ["in progress", "halftime", "overtime", "beginning of period", "end of period"];
        if (arrLiveStatuses.includes(this.strGameStatus.toLowerCase())) {
            this.blnLiveGame = true;
        }

        //*** Set Has Started Flag */
        this.blnHasStarted = objCompetition.boxscoreAvailable;

        //*** Get Game Info object */
        const objGameInfo = pjsonGameData.gameInfo

        //*** Extract Venue Information */
        this.strCityName = objGameInfo.venue.address.city + " " + objGameInfo.venue.address.state;
        this.strVenueName = objGameInfo.venue.fullName;
        this.strAttendance = objGameInfo.attendance;

        //*** Extract Team Stat Information
        const arrCompetitors = objCompetition.competitors;
        for (let i = 0; i < arrCompetitors.length; i++) {
            const objCompetitor = arrCompetitors[i];
            const objTeamStats = new TeamStats();

            //*** Extra Team Info */
            objTeamStats.strTeamCode = objCompetitor.team.abbreviation;
            objTeamStats.strTeamName = objCompetitor.team.name;

            //*** Extract Score Information */
            objTeamStats.intScore = objCompetitor.score ? parseInt(objCompetitor.score) : 0;
            const arrLineScores = objCompetitor.linescores;
            if (arrLineScores && arrLineScores.length > 0) {
                for (let j = 0; j < arrLineScores.length; j++) {
                    objTeamStats.arrPeriodScore.push(arrLineScores[j].displayValue);
                }
            }

            //*** Determine if Team is Home or Away */
            if (objCompetitor.homeAway === "home") {
                objTeamStats.blnHomeTeam = true;
                this.objHomeTeam = objTeamStats;
            } else {
                objTeamStats.blnHomeTeam = false;
                this.objAwayTeam = objTeamStats;
            }
        }

        //*** Extract Player Stat Information */
        const arrTeamBoxScore = pjsonGameData.boxscore.players;
        if (arrTeamBoxScore && arrTeamBoxScore.length > 0) {
            for (let i = 0; i < arrTeamBoxScore.length; i++) {
                //*** Determine Team the Stats are for */
                const strTeamBoxScoreCode = arrTeamBoxScore[i].team.abbreviation;

                //*** Loop through player stats */
                const arrPlayerStats = arrTeamBoxScore[i].statistics[0].athletes
                for (let j = 0; j < arrPlayerStats.length; j++) {
                    const objPlayerStats = new PlayerStats();

                    //*** Get Athlete Info */
                    objPlayerStats.strName = arrPlayerStats[j].athlete.shortName;
                    objPlayerStats.strPosition = arrPlayerStats[j].athlete.position.abbreviation;
                    objPlayerStats.strNumber = arrPlayerStats[j].athlete.jersey;
                    objPlayerStats.blnStarter = arrPlayerStats[j].starter;
                    objPlayerStats.strDNPReason = arrPlayerStats[j].reason;

                    //*** Get Box Score Info */
                    const objStats = arrPlayerStats[j].stats
                    if (objStats && objStats.length > 0) {
                        objPlayerStats.intMinutes = parseInt(objStats[0]);
                        objPlayerStats.intPoints = parseInt(objStats[13]);
                        const arrFGStats = objStats[1].split("-");
                        objPlayerStats.intFGM = parseInt(arrFGStats[0]);
                        objPlayerStats.intFGA = parseInt(arrFGStats[1]);
                        const arr3PStats = objStats[2].split("-");
                        objPlayerStats.int3PM = parseInt(arr3PStats[0]);
                        objPlayerStats.int3PA = parseInt(arr3PStats[1]);
                        const arrFTStats = objStats[3].split("-");
                        objPlayerStats.intFTM = parseInt(arrFTStats[0]);
                        objPlayerStats.intFTA = parseInt(arrFTStats[1]);
                        objPlayerStats.intREB = parseInt(objStats[6]);
                        objPlayerStats.intOREB = parseInt(objStats[4]);
                        objPlayerStats.intDREB = parseInt(objStats[5]);
                        objPlayerStats.intAST = parseInt(objStats[7]);
                        objPlayerStats.intSTL = parseInt(objStats[8]);
                        objPlayerStats.intBLK = parseInt(objStats[9]);
                        objPlayerStats.intTO = parseInt(objStats[10]);
                        objPlayerStats.intPF = parseInt(objStats[11]);
                        objPlayerStats.intPlusMinus = parseInt(objStats[12]);
                    }

                    //*** Determine where to push this player stat into */
                    const objTargetTeam = (this.objHomeTeam.strTeamCode === strTeamBoxScoreCode) ? this.objHomeTeam : this.objAwayTeam;
                    objTargetTeam.procAddPlayerStat(objPlayerStats);
                }
            }
        }

        //*** Sort Players by Minutes Played */
        this.objHomeTeam.procSortPlayerStatsByMinutes();
        this.objAwayTeam.procSortPlayerStatsByMinutes();

        //*** Set Data Loaded Flag */
        this.blnDataLoaded = true;
    }

	procOnForceRefresh() {
		//*** Reload data and re-render
		(async () => {
			await this.procLoadGameData();
			this.procRenderWidgetContainer();
		})();
	}

    //*** Render Widget Container */
    procRenderWidgetContainer() {
        //*** Initialize Widget Container
        const divNBAGameWidgetContainer = document.querySelector('#' + this.strWidgetDiv);
        divNBAGameWidgetContainer.innerHTML = "";

        //*** Initialize Widget */
        const divNBAGameWidget = document.createElement("div");
        divNBAGameWidget.className = "bbw-nbagamewidget"

        //*** Add Header */
        divNBAGameWidget.appendChild(this.funcRenderComponentHeader());

        //*** Check if Data Loaded */
        if(!this.blnDataLoaded) {
            divNBAGameWidget.appendChild(this.funcRenderComponentNoData());
            divNBAGameWidgetContainer.appendChild(divNBAGameWidget);
        } else {
        //*** Render Widget Header & Tab
            divNBAGameWidget.appendChild(this.funcRenderComponentSummaryHeader());
            divNBAGameWidget.appendChild(this.funcRenderComponentTabGroup());

            //*** Render Active Tab */
            switch (this.strActiveTab) {
                case "summary": 
                    divNBAGameWidget.appendChild(this.funcRenderComponentSummaryTab());
                    break;
                case "boxscore":
                    divNBAGameWidget.appendChild(this.funcRenderComponentBoxScoreTab(this.strBoxScorePrimaryOrSecondary, this.strBoxScoreFullOrCompact));
                    break;    
                case "teams":
                    divNBAGameWidget.appendChild(this.funcRenderComponentTeamsTab());
                    break;
                case "injury":
                    divNBAGameWidget.appendChild(this.funcRenderComponentInjuryTab());
                    break;
            }

            //*** Append to Container */
            divNBAGameWidgetContainer.appendChild(divNBAGameWidget);
        }
    }

    //*** Render Widget Header */  
    funcRenderComponentHeader() {
        //*** Build Widget Title */
        const divWidgetTitle = document.createElement("div");
        divWidgetTitle.className = "bbw-nbagamewidget-header-title"
        divWidgetTitle.innerText = "Game Overview";

        //*** Build Team Logo (Empty for Now) */
        const divTeamLogo = document.createElement("div");
        divTeamLogo.className = "bbw-nbagamewidget-header-logo";

        //*** Build Widget Buttons */
        const divHeaderButtons = document.createElement("div");
		const divRefreshButton = document.createElement("div");
		divHeaderButtons.className = "bbw-nbagamewidget-header-buttongroup";
		divRefreshButton.className = "bbw-nbagamewidget-header-button";
        divRefreshButton.innerHTML = NBAGameWidget.funcRenderRefreshIcon();
        divHeaderButtons.appendChild(divRefreshButton);

		//*** Add click refresh event
		divRefreshButton.addEventListener('click', () => {
			this.procOnForceRefresh();
		});

		//*** Build Header Container
		const divHeaderContainer = document.createElement("div");
		divHeaderContainer.className = "bbw-nbagamewidget-header-container";
        divHeaderContainer.appendChild(divTeamLogo);
        divHeaderContainer.appendChild(divWidgetTitle);
        divHeaderContainer.appendChild(divHeaderButtons);
		return divHeaderContainer;
    }

    //*** Render Game Header */
    funcRenderComponentSummaryHeader() {
        //*** Get Game Date */
        const divGameDate = document.createElement("div");
        divGameDate.className = "bbw-nbagamewidget-header-banner-gamedate";
        const arrGameDateOptions = { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: 'numeric', minute: '2-digit', hour12: true };
        divGameDate.innerHTML = this.dtmGameDate.toLocaleDateString("en-US", arrGameDateOptions);

        //*** Get Game Location */
        const divLocation = document.createElement("div");
        divLocation.className = "bbw-nbagamewidget-header-banner-location";
        divLocation.innerHTML = this.strVenueName + " - " + this.strCityName;

        //*** Create Game Banner */
        const divBanner = document.createElement("div");
        divBanner.className = "bbw-nbagamewidget-header-banner";
        divBanner.appendChild(divGameDate);
        divBanner.appendChild(divLocation);

        //*** Determine Primary and Secondary Teams */
        const objPrimaryTeam = this.funcGetPrimaryTeam();
        const objSecondaryTeam = this.funcGetSecondaryTeam();

        //*** Create Primary Team */
        const divPrimaryTeam = document.createElement("div");
        const divPrimaryTeamName = document.createElement("div");
        const imgPrimaryTeamLogo = document.createElement("img");

        divPrimaryTeamName.className = "bbw-nbagamewidget-header-score-primaryname";
        divPrimaryTeamName.innerHTML = objPrimaryTeam.strTeamName + (objPrimaryTeam.blnHomeTeam ? " &#127968;" : "");

        imgPrimaryTeamLogo.className = "bbw-nbagamewidget-header-score-primarylogo";
        imgPrimaryTeamLogo.src = NBAGameWidget.funcGetTeamLogoURL(objPrimaryTeam.strTeamCode);

        divPrimaryTeam.className = "bbw-nbagamewidget-header-score-primary";
        divPrimaryTeam.appendChild(imgPrimaryTeamLogo);
        divPrimaryTeam.appendChild(divPrimaryTeamName);

        //*** Create Secondary Team */
        const divSecondaryTeam = document.createElement("div");
        const divSecondaryTeamName = document.createElement("div");
        const imgSecondaryTeamLogo = document.createElement("img");

        divSecondaryTeamName.className = "bbw-nbagamewidget-header-score-secondaryname";
        divSecondaryTeamName.innerHTML = (objSecondaryTeam.blnHomeTeam ? "&#127968; " : "") + objSecondaryTeam.strTeamName;

        imgSecondaryTeamLogo.className = "bbw-nbagamewidget-header-score-secondarylogo";
        imgSecondaryTeamLogo.src = NBAGameWidget.funcGetTeamLogoURL(objSecondaryTeam.strTeamCode);

        divSecondaryTeam.className = "bbw-nbagamewidget-header-score-secondary";
        divSecondaryTeam.appendChild(divSecondaryTeamName);
        divSecondaryTeam.appendChild(imgSecondaryTeamLogo);

        //*** Create Score  */
        const divScore = document.createElement("div");
        divScore.className = "bbw-nbagamewidget-header-score-status-score";
        const intPrimaryScore = objPrimaryTeam.intScore;
        const intSecondaryScore = objSecondaryTeam.intScore;
        if (intPrimaryScore > intSecondaryScore) {
            divScore.innerHTML = `<b>${intPrimaryScore}</b> - ${intSecondaryScore}`;
        } else if (intSecondaryScore > intPrimaryScore) {
            divScore.innerHTML = `${intPrimaryScore} - <b>${intSecondaryScore}</b>`;
        } else {
            divScore.innerHTML = `${intPrimaryScore} - ${intSecondaryScore}`;
        }

        //*** Create Status */
        const divStatus = document.createElement("div");
        divStatus.className = "bbw-nbagamewidget-header-score-status-status";
        divStatus.innerHTML = this.funcGetStatusToDisplay();

        //*** Create Score/Status Element */
        const divScoreStatus = document.createElement("div");
        divScoreStatus.className = "bbw-nbagamewidget-header-score-status";
        divScoreStatus.appendChild(divScore);
        divScoreStatus.appendChild(divStatus);

        //*** Create Score Banner */
        const divScoreBanner = document.createElement("div");
        divScoreBanner.className = "bbw-nbagamewidget-header-score";
        divScoreBanner.appendChild(divPrimaryTeam);
        divScoreBanner.appendChild(divScoreStatus);
        divScoreBanner.appendChild(divSecondaryTeam);

        //*** Build and Return Rendered Summary Header */
        const divSummaryHeader = document.createElement("div");
        divSummaryHeader.className = "bbw-nbagamewidget-header";
        divSummaryHeader.appendChild(divBanner);
        divSummaryHeader.appendChild(divScoreBanner);
        return divSummaryHeader;
    }

    //*** Render Tabs */
    funcRenderComponentTabGroup() {
		const divTabGroup = document.createElement("div");
		divTabGroup.className = 'bbw-nbagamewidget-tabgroup';

        //*** Build Out Tab Objects */
        this.tabSummary = this.funcRenderAndBuildTab("summary", "Summary");
		this.tabBoxScore = this.funcRenderAndBuildTab("boxscore", "Box Score");
        this.tabTeams = this.funcRenderAndBuildTab("teams", "Head to Head");;
        this.tabInjury = this.funcRenderAndBuildTab("injury", "Injuries");;

		//*** Build Rendered Tab Group
		divTabGroup.appendChild(this.tabSummary);
		divTabGroup.appendChild(this.tabBoxScore);
        divTabGroup.appendChild(this.tabTeams);
        divTabGroup.appendChild(this.tabInjury);
        return divTabGroup;	
	} 

    //*** Render a Tab with Event Handling */
    funcRenderAndBuildTab(pstrTabCode, pstrTabTitle) {
		//*** Create  Tab
		const divTab = document.createElement("div");
        divTab.className = "bbw-nbagamewidget-tab";
        divTab.id = "bbw-nbagamewidget-tab-" + pstrTabCode;
        divTab.innerText = pstrTabTitle;

        //*** Set Default Status */
        divTab.classList.toggle("active", this.strActiveTab === pstrTabCode);

        //*** Set Events
        divTab.addEventListener('click', () => {
			this.procOnTabChange(pstrTabCode);
		});

        //*** Return Built Out Tab */
        return divTab;
    }

    //*** Handle Tab Change Re-Renders */
    procOnTabChange(pstrSelectedTab) {
        //*** Set Active tab
		this.strActiveTab = pstrSelectedTab;

		//*** Re-Render Widget
		this.procRenderWidgetContainer();
    }

    //*** Render Summary Tab */
    funcRenderComponentSummaryTab() {
        //*** Determine Primary and Secondary Teams */
        const objPrimaryTeam = this.funcGetPrimaryTeam();
        const objSecondaryTeam = this.funcGetSecondaryTeam();
        
        //*** Create Period Score Data */
        const arrPeriodHeader = ["Team", "Q1", "Q2", "Q3", "Q4"];
        const arrPrimaryTeamPeriods = objPrimaryTeam.funcGetPeriodTable();
        const arrSecondaryTeamPeriods = objSecondaryTeam.funcGetPeriodTable();
        const arrPeriodScores = arrPrimaryTeamPeriods.concat(arrSecondaryTeamPeriods);

        //*** Determine if OT periods existed */
        for (let i = 6; i < arrPrimaryTeamPeriods[0].length; i++) {
            arrPeriodHeader.push("OT" + (i - 5));
        }

        //*** Push Total Score */
        arrPeriodHeader.push("TOT");

        //*** Render Period Scores Table */
        const divPeriodScores = NBAGameWidget.funcRenderTable("Scoreboard", "50px",arrPeriodHeader, arrPeriodScores);

        //*** Create Team Leader Compare */
        let arrTeamLeaders = [];

        //*** Get Points Leaders */
        arrTeamLeaders.push([
            objPrimaryTeam.strPointLeader + " (" + objPrimaryTeam.intPointLeaderPoints + ")",
            "Points",
            objSecondaryTeam.strPointLeader + " (" + objSecondaryTeam.intPointLeaderPoints + ")"
        ]);

        //*** Get Rebounds Leaders */
        arrTeamLeaders.push([
            objPrimaryTeam.strReboundLeader + " (" + objPrimaryTeam.intReboundLeaderRebounds + ")",
            "Rebounds",
            objSecondaryTeam.strReboundLeader + " (" + objSecondaryTeam.intReboundLeaderRebounds + ")"
        ]);

        //*** Get Assist Leaders */
        arrTeamLeaders.push([
            objPrimaryTeam.strAssistLeader + " (" + objPrimaryTeam.intAssistLeaderAssists + ")",
            "Assists",
            objSecondaryTeam.strAssistLeader + " (" + objSecondaryTeam.intAssistLeaderAssists + ")",
        ]);

        //*** Build Team Leader Component */
        const divTeamLeaders = NBAGameWidget.funcRenderComparison("Team Leaders",arrTeamLeaders);

        //*** Create Summary Widget */
        const divGameSummary = document.createElement("div");
        divGameSummary.className = "bbw-nbagamewidget-gamesummary";
        divGameSummary.appendChild(divPeriodScores);
        divGameSummary.appendChild(divTeamLeaders);

        //*** Return Rendered Component */
        return divGameSummary;
    }

    //*** Render Box Score Tab */
    funcRenderComponentBoxScoreTab() {
        //*** Determine Teams */
        const objPrimaryTeam = this.funcGetPrimaryTeam();
        const objSecondaryTeam = this.funcGetSecondaryTeam();

		//*** Create Team Select Option
		const selectTeam = document.createElement("select");
        selectTeam.id = "bbw-nbagamewidget-boxscore-param-select-team"
        let arrTeamOptions = [];
        arrTeamOptions.push({value: "primary", text: objPrimaryTeam.strTeamName});
        arrTeamOptions.push({value:"secondary", text: objSecondaryTeam.strTeamName});
		arrTeamOptions.forEach(option => {
			const optionElement = document.createElement("option");
			optionElement.value = option.value;
			optionElement.innerText = option.text;
			selectTeam.appendChild(optionElement);
		});
        selectTeam.value = this.strBoxScorePrimaryOrSecondary;
        this.selectBoxScoreTeam = selectTeam;
        this.selectBoxScoreTeam.addEventListener('change', () => {
            this.strBoxScorePrimaryOrSecondary = this.selectBoxScoreTeam.value;
            this.procRenderWidgetContainer();
        });

        //*** Create Box Score Style Option */
		const selectStyle = document.createElement("select");
        selectStyle.id = "bbw-nbagamewidget-boxscore-param-select-style"
		const arrStyleOptions = [
			{ value: "compact", text: "Compact" },
			{ value: "full", text: "Detailed" },
		];
		arrStyleOptions.forEach(option => {
			const optionElement = document.createElement("option");
			optionElement.value = option.value;
			optionElement.innerText = option.text;
			selectStyle.appendChild(optionElement);
		});
        selectStyle.value = this.strBoxScoreFullOrCompact;
        this.selectBoxScoreStyle = selectStyle;
        this.selectBoxScoreStyle.addEventListener('change', () => {
            this.strBoxScoreFullOrCompact = this.selectBoxScoreStyle.value;
            this.procRenderWidgetContainer();
        });

        //*** Create Options Bar */
        const divOptions = document.createElement("div")
        divOptions.className = "bbw-nbagamewidget-boxscore-options"
        divOptions.appendChild(selectTeam);
        divOptions.appendChild(selectStyle);

        //*** Determine Team to Display
        let objDisplayTeam = null;
        if (this.strBoxScorePrimaryOrSecondary.toLowerCase() === "primary") {
            objDisplayTeam = this.funcGetPrimaryTeam();
        } else {
            objDisplayTeam = this.funcGetSecondaryTeam();
        }

        //*** Create Box Score Header */
        let arrBoxScoreHeader = [];
        if(this.strBoxScoreFullOrCompact.toLowerCase() === "full") {
            arrBoxScoreHeader = [
                "",
                "Min",
                "FGs",
                "3PTs",
                "FTs",
                "OReb",
                "DReb",
                "Reb",
                "Ast",
                "Stl",
                "Blk",
                "TO",
                "PF",
                "+/-",
                "Points"
            ]
        } else {
            arrBoxScoreHeader = [
                "",
                "Min",
                "Pts",
                "Reb",
                "Ast",
                "Stl",
                "Blk"
            ]
        }

        //*** Create Elements for Box Score */
        const divBoxScoreStarters = NBAGameWidget.funcRenderTable("Starters", "50px",arrBoxScoreHeader, objDisplayTeam.funcGetPlayerStats(this.strBoxScoreFullOrCompact,["starter"]));
        const divBoxScoreBench = NBAGameWidget.funcRenderTable("Bench", "50px",arrBoxScoreHeader, objDisplayTeam.funcGetPlayerStats(this.strBoxScoreFullOrCompact,["bench", "dnp"]));

        //*** Create Box Score Content */
        const divBoxScoreContent = document.createElement("div");
        divBoxScoreContent.className = "bbw-nbagamewidget-boxscore-content";
        divBoxScoreContent.appendChild(divBoxScoreStarters);
        divBoxScoreContent.appendChild(divBoxScoreBench);
        if(this.strBoxScoreFullOrCompact.toLowerCase() === "full") {
            divBoxScoreContent.style.minWidth = "850px";
        }

        //*** Create Summary Widget */
        const divBoxScore = document.createElement("div");
        divBoxScore.className = "bbw-nbagamewidget-boxscore";
        divBoxScore.appendChild(divOptions);
        divBoxScore.appendChild(divBoxScoreContent);
        return divBoxScore;
    }

    //*** Render Head to Head Tab */
    funcRenderComponentInjuryTab() {
        const divNoData = document.createElement("div");
		divNoData.className = "bbw-nbagamewidget-nodata";
		divNoData.innerText = "Coming Soon...";
		return divNoData;
    }

    //*** Render Injuries Tab */
    funcRenderComponentInjuryTab() {
        const divNoData = document.createElement("div");
		divNoData.className = "bbw-nbagamewidget-nodata";
		divNoData.innerText = "Coming Soon...";
		return divNoData;
    }

    //*** Render Team Compare Tab */
    funcRenderComponentTeamsTab() {
        const divNoData = document.createElement("div");
		divNoData.className = "bbw-nbagamewidget-nodata";
		divNoData.innerText = "Coming Soon...";
		return divNoData;
    }

    //*** Render No Data */
    funcRenderComponentNoData() {
        //*** Create No Data Box */
        const divNoData = document.createElement("div");
		divNoData.className = "bbw-nbagamewidget-nodata";

        //*** Determine if Reason is not logged in */
		let strReason = "";
		if (!this.funcAllowWidgetRun()) { 
			divNoData.innerText = "Must be logged in to use widget";
		} else {
			divNoData.innerText =  "In order to prevent unecessary calls\nwidget must be manually loaded\n\n";
            const divRefreshButton = document.createElement("div");
            divRefreshButton.className = "bbw-nbagamewidget-button"
            divRefreshButton.innerText ="Refresh Widget";
            divRefreshButton.style.maxWidth = "125px";
            divRefreshButton.addEventListener("click", (e) => {
                e.preventDefault();
                this.procOnForceRefresh();
            });
            divNoData.appendChild(divRefreshButton);
		}

		//*** Return */
		return divNoData;
    }

    //*** Get Primary and Secondary Team Display Logic */
    funcGetPrimaryTeam() {
        if(this.objAwayTeam.strTeamCode.toLowerCase() === this.strPrimaryTeam.toLowerCase()) {
            return this.objAwayTeam
        } else {
            return this.objHomeTeam;
        }
        
    }
    funcGetSecondaryTeam() {
        if(this.objAwayTeam.strTeamCode.toLowerCase() === this.strPrimaryTeam.toLowerCase()) {
            return this.objHomeTeam
        } else {
            return this.objAwayTeam;
        }
    }
    //*** Get Status to Display */
    funcGetStatusToDisplay() {
        //*** Return Status status detail if game is live */
        if (this.blnHasStarted) {
            return this.strGameStatusDetail;
        } else {
            return this.strGameStatus;
        }
    }


    //*** Generically Render a Table */
    static funcRenderTable(pstrTitle, pstrColumnWidth, parrHeaderNames, parrRowData) {
        /*** Create Table */
        const divTable = document.createElement("div");
        divTable.className = "bbw-nbagamewidget-table";

        /*** Create Title */
        if (pstrTitle != "") {
            const divTableTitle = document.createElement("div");
            divTableTitle.className = "bbw-nbagamewidget-table-title";
            divTableTitle.innerHTML = pstrTitle;
            divTable.appendChild(divTableTitle);
        }

        /*** Create Header Row */
        if (parrHeaderNames && parrHeaderNames.length > 0) {
            /*** Create Header Row */
            const divTableHeader = document.createElement("div");
            divTableHeader.className = "bbw-nbagamewidget-table-header";

            /*** Create Key Column */
            const divTableHeaderKey = document.createElement("div");
            divTableHeaderKey.className = "bbw-nbagamewidget-table-header-key";
            divTableHeaderKey.innerHTML = parrHeaderNames[0];
            divTableHeader.appendChild(divTableHeaderKey);

            /*** Create Remaining Columns */
            for (let i = 1; i < parrHeaderNames.length; i++) {
                const divTableHeaderColumn = document.createElement("div");
                divTableHeaderColumn.className = "bbw-nbagamewidget-table-header-column";
                divTableHeaderColumn.innerHTML = parrHeaderNames[i];
                divTableHeaderColumn.style.maxWidth = pstrColumnWidth;
                divTableHeader.appendChild(divTableHeaderColumn);
            }

            /*** Append to Table */
            divTable.appendChild(divTableHeader);
        }

        /*** Create Column Row */
        if (parrRowData && parrRowData.length > 0) {
            for (let i = 0; i < parrRowData.length; i++) {
                /*** Create Table Row */
                const divTableRow = document.createElement("div");
                divTableRow.className = "bbw-nbagamewidget-table-row";

                //*** Create Key Column */
                const divTableRowKey = document.createElement("div");
                divTableRowKey.className = "bbw-nbagamewidget-table-row-key";
                divTableRowKey.innerHTML = parrRowData[i][0];
                divTableRow.appendChild(divTableRowKey);

                /*** Create Remaining Columns */
                for (let j = 1; j < parrRowData[i].length; j++) {
                    const divTableRowColumn = document.createElement("div");
                    divTableRowColumn.className = "bbw-nbagamewidget-table-row-column";
                    divTableRowColumn.innerHTML = parrRowData[i][j];
                    divTableRowColumn.style.maxWidth = pstrColumnWidth;
                    divTableRow.appendChild(divTableRowColumn);
                }

                /*** Append to Table */
                divTable.appendChild(divTableRow);
            }
        }

        //*** Return Rendered Table */
        return divTable;
    }

    //*** Generally Render a Stat Comparison Table  */
    static funcRenderComparison(pstrTitle,parrRowData) {
        //*** Create Compare Component */
        const divCompare = document.createElement("div");
        divCompare.className = "bbw-nbagamewidget-compare";

        //*** Create Title */
        const divTitle = document.createElement("div");
        divTitle.className = "bbw-nbagamewidget-compare-title";
        divTitle.innerHTML = "Team Leaders";
        divCompare.appendChild(divTitle);

        //*** Loop Through and Create Rows */
        for(let i=0;i<parrRowData.length;i++) {
            //*** Create Row Element */
            const divRow = document.createElement("div");
            divRow.className = "bbw-nbagamewidget-compare-row";

            //*** Create Primary Element */
            const divPrimary = document.createElement("div");
            divPrimary.className = "bbw-nbagamewidget-compare-row-primary";
            divPrimary.innerHTML = parrRowData[i][0];
            divRow.appendChild(divPrimary);

            //*** Create Label Element */
            const divLabel = document.createElement("div");
            divLabel.className = "bbw-nbagamewidget-compare-row-label";
            divLabel.innerHTML = parrRowData[i][1];
            divRow.appendChild(divLabel);

            //*** Create Secondary Element */
            const divSecondary = document.createElement("div");
            divSecondary.className = "bbw-nbagamewidget-compare-row-secondary";
            divSecondary.innerHTML = parrRowData[i][2];
            divRow.appendChild(divSecondary);

            //*** Append to Compare Component */
            divCompare.appendChild(divRow);
        }

        //*** Return Rendered Component */
        return divCompare;
    }

    //*** Get team logo URL
    static funcGetTeamLogoURL(pstrTeamAbbr) {
        //*** Use the same mapping from Game class
        const strTeamId = NBAGameWidget.mapNBAdotComTeamIDs[pstrTeamAbbr];
        if (strTeamId) {
            return `https://cdn.nba.com/logos/nba/${strTeamId}/primary/L/logo.svg`;
        }
        return "https://cdn.nba.com/logos/nba/logo.svg";
    }

	//*** Refresh Icon
	static funcRenderRefreshIcon() {
		return `<svg id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 118.04 122.88"><path d="M16.08,59.26A8,8,0,0,1,0,59.26a59,59,0,0,1,97.13-45V8a8,8,0,1,1,16.08,0V33.35a8,8,0,0,1-8,8L80.82,43.62a8,8,0,1,1-1.44-15.95l8-.73A43,43,0,0,0,16.08,59.26Zm22.77,19.6a8,8,0,0,1,1.44,16l-10.08.91A42.95,42.95,0,0,0,102,63.86a8,8,0,0,1,16.08,0A59,59,0,0,1,22.3,110v4.18a8,8,0,0,1-16.08,0V89.14h0a8,8,0,0,1,7.29-8l25.31-2.3Z"/></svg>`
	}


    //*** NBA Team Logo Mappings
    static mapNBAdotComTeamIDs = {
        // Eastern Conference
        "ATL": 1610612737, // Atlanta Hawks
        "BOS": 1610612738, // Boston Celtics  
        "BKN": 1610612751, // Brooklyn Nets
        "CHA": 1610612766, // Charlotte Hornets
        "CHI": 1610612741, // Chicago Bulls
        "CLE": 1610612739, // Cleveland Cavaliers
        "DET": 1610612765, // Detroit Pistons
        "IND": 1610612754, // Indiana Pacers
        "MIA": 1610612748, // Miami Heat
        "MIL": 1610612749, // Milwaukee Bucks
        "NY": 1610612752,  // New York Knicks
        "NYK": 1610612752, // New York Knicks (alternate)
        "ORL": 1610612753, // Orlando Magic
        "PHI": 1610612755, // Philadelphia 76ers
        "TOR": 1610612761, // Toronto Raptors
        "WAS": 1610612764, // Washington Wizards
        "WSH": 1610612764, // Washington Wizards (alternate)

        // Western Conference
        "DAL": 1610612742, // Dallas Mavericks
        "DEN": 1610612743, // Denver Nuggets
        "GS": 1610612744,  // Golden State Warriors
        "GSW": 1610612744, // Golden State Warriors (alternate)
        "HOU": 1610612745, // Houston Rockets
        "LAC": 1610612746, // Los Angeles Clippers
        "LAL": 1610612747, // Los Angeles Lakers
        "MEM": 1610612763, // Memphis Grizzlies
        "MIN": 1610612750, // Minnesota Timberwolves
        "NO": 1610612740,  // New Orleans Pelicans
        "NOP": 1610612740, // New Orleans Pelicans (alternate)
        "OKC": 1610612760, // Oklahoma City Thunder
        "PHX": 1610612756, // Phoenix Suns
        "POR": 1610612757, // Portland Trail Blazers
        "SAC": 1610612758, // Sacramento Kings
        "SA": 1610612759,  // San Antonio Spurs
        "SAS": 1610612759, // San Antonio Spurs (alternate)
        "UTA": 1610612762,  // Utah Jazz
        "UTAH": 1610612762  // Utah Jazz (alternate)
    };
}

//*** Class to track statistics for specific team within Game */
class TeamStats {
    constructor() {
        //*** Initialize General Status */
        this.strTeamCode = "";
        this.strTeamName = "";
        this.blnHomeTeam = false;

        //*** Initialize Statistics Leaders */
        this.strPointLeader = "";
        this.intPointLeaderPoints = 0;
        this.strAssistLeader = "";
        this.intAssistLeaderAssists = 0;
        this.strReboundLeader = "";
        this.intReboundLeaderRebounds = 0;

        //*** Initialize Score Info */
        this.intScore = 0;
        this.arrPeriodScore = [];

        //*** Initialize Player Info */
        this.arrStarterStats = [];
        this.arrBenchStats = [];
        this.arrDNPStats = [];
    }

    //*** Handle Add Player Stats */
    procAddPlayerStat(pobjPlayerStat) {
        //*** Push into relevant array */
        if (pobjPlayerStat.blnStarter) {
            this.arrStarterStats.push(pobjPlayerStat);
        } else if (pobjPlayerStat.intMinutes === 0) {
            this.arrDNPStats.push(pobjPlayerStat);
        } else {
            this.arrBenchStats.push(pobjPlayerStat);
        }

        //*** Update Points Team Leaders */
        if (pobjPlayerStat.intPoints > this.intPointLeaderPoints) {
            this.strPointLeader = pobjPlayerStat.strName;
            this.intPointLeaderPoints = pobjPlayerStat.intPoints;
        }

        //*** Update Assist Team Leaders */
        if (pobjPlayerStat.intAST > this.intAssistLeaderAssists) {
            this.strAssistLeader = pobjPlayerStat.strName;
            this.intAssistLeaderAssists = pobjPlayerStat.intAST;
        }

        //*** Update Rebounds Team Leaders */
        if (pobjPlayerStat.intREB > this.intReboundLeaderRebounds) {
            this.strReboundLeader = pobjPlayerStat.strName;
            this.intReboundLeaderRebounds = pobjPlayerStat.intREB;
        }
    }

    //*** Sort Player Stats by Minutes Played */
    procSortPlayerStatsByMinutes() {
        this.arrStarterStats.sort((a, b) => b.intMinutes - a.intMinutes);
        this.arrBenchStats.sort((a, b) => b.intMinutes - a.intMinutes);
        this.arrDNPStats.sort((a, b) => b.intMinutes - a.intMinutes);
    }

    //*** Get Starter Stats Table Data */
    funcGetPlayerStats(pstrDisplayType, parrPlayerTypes) {
        //*** Determine the stats  */
        const arrCombinedPlayerStats = [];

        //*** Add Starter Stats */
        if (parrPlayerTypes.includes("starter")) {
            for (let i = 0; i < this.arrStarterStats.length; i++) {
                arrCombinedPlayerStats.push(this.arrStarterStats[i].funcGetPlayerStats(pstrDisplayType));
            }
        }

        //*** Add Bench Stats */
        if (parrPlayerTypes.includes("bench")) {
            for (let i = 0; i < this.arrBenchStats.length; i++) {
                arrCombinedPlayerStats.push(this.arrBenchStats[i].funcGetPlayerStats(pstrDisplayType));
            }
        }

        //*** Add DNP Stats */
        if (parrPlayerTypes.includes("dnp")) {
            for (let i = 0; i < this.arrDNPStats.length; i++) {
                arrCombinedPlayerStats.push(this.arrDNPStats[i].funcGetPlayerStats(pstrDisplayType));
            }
        }

        return arrCombinedPlayerStats;
    }

    //*** Get Period Table Data */
    funcGetPeriodTable() {
        const periodData = this.arrPeriodScore.length > 0 ? this.arrPeriodScore : ["0", "0", "0", "0"];
        return [[this.strTeamName, ...periodData, this.intScore]];
    }

}

class PlayerStats {
    constructor() {
        //*** Initialize Player Info */
        this.strName = "";
        this.strPosition = "";
        this.strNumber = "";
        this.blnStarter = false;
        this.strDNPReason = "";

        //*** Initialize Stats */
        this.intMinutes = 0;
        this.intPoints = 0;
        this.intFGM = 0;
        this.intFGA = 0;
        this.int3PM = 0;
        this.int3PA = 0;
        this.intFTM = 0;
        this.intFTA = 0;
        this.intREB = 0;
        this.intOREB = 0;
        this.intDREB = 0;
        this.intAST = 0;
        this.intSTL = 0;
        this.intBLK = 0;
        this.intTO = 0;
        this.intPF = 0;
        this.intPlusMinus = 0;
    }

    //*** Return Formatted Box Score */
    funcGetPlayerStats(pstrDisplayType) {
        switch (pstrDisplayType.toLowerCase()) {
            case "full":
                return [
                    this.strName,
                    this.intMinutes,
                    this.intFGM + "-" + this.intFGA,
                    this.int3PM + "-" + this.int3PA,
                    this.intFTM + "-" + this.intFTA,
                    this.intOREB,
                    this.intDREB,
                    this.intREB,
                    this.intAST,
                    this.intSTL,
                    this.intBLK,
                    this.intTO,
                    this.intPF,
                    this.intPlusMinus,
                    this.intPoints
                ]
            default: //*** Compact */
                return [
                    this.strName,
                    this.intMinutes,
                    this.intPoints,
                    this.intREB,
                    this.intAST,
                    this.intSTL,
                    this.intBLK
                ]
        }

    }

    //*** Return Formatted Box Score */
    funcGetPlayerStatsCompact() {

    }

}

/* API Manager Class
Seggregating API Calls away from Widget class for future modularity
*/
class APIManager {
    // Constructor
    constructor() {
        //*** Default Debug Mode is False
        this.blnDebugMode = false;
    }

    //*** Set Debug Method - Controls Logging
    procSetDebugMode(pblnDebugMode) {
        this.blnDebugMode = pblnDebugMode;
    }

    // Get Data from Any REST API with Caching
    async funcGetAPIData(pstrApiUrl, pstrMethod) {
        //*** Wrapper method to allow other types of fetches that then build JSON (ie: screen scrapper)
        switch (pstrMethod.toLowerCase()) {
            case "json":
                return await this.funcFetchJSONDataFromURL(pstrApiUrl);
            default:
                console.error("API Method not supported: ", pstrMethod)
                return null;
        }
    }

    // Fetch Data from Any JSON based REST API
    async funcFetchJSONDataFromURL(pstrApiUrl) {
        //*** Log URL being fetched
        if (this.blnDebugMode) { console.log("API Manager - Fetching JSON from URL: " + pstrApiUrl); }

        //*** Attempt to fetch from API
        try {
            //*** Make the HTTP request
            const objResponse = await fetch(pstrApiUrl);

            //*** Check if response was successful
            if (!objResponse.ok) {
                console.error(`API Manager- HTTP Error: ${objResponse.status} ${objResponse.statusText}`);
                return null;
            }

            //*** Parse JSON response
            const jsonData = await objResponse.json();

            //*** Log successful response
            if (this.blnDebugMode) {
                console.log("API Manager - Fetch successful. Top-level keys:", Object.keys(jsonData));
            }

            //*** Return the parsed JSON
            return jsonData;

        } catch (error) {
            //*** Log the error and return null for soft failure
            console.error("API Manager - Fetch error:", error.message);
            return null;
        }
    }

}

/* Storage Manager Class
Seggregating Storage Management away from Widget class for future modularity
*/
class StorageManager {
    // Constructor
    constructor(pstrStorageNamespace) {
        //*** Validate Namespace is Provided
        if (!pstrStorageNamespace || pstrStorageNamespace.trim() === "") {
            throw new Error("Data Manager - Storage namespace is required");
        }

        //*** Store Namespace
        this.strStorageNamespace = pstrStorageNamespace;

        //*** Default Debug Mode is False
        this.blnDebugMode = false;
    }

    //*** Set Debug Method - Controls Logging
    procSetDebugMode(pblnDebugMode) {
        this.blnDebugMode = pblnDebugMode;
    }

    //*** Build Namespaced Storage Key
    funcBuildNamespacedKey(pstrStorageKey) {
        return `${this.strStorageNamespace}::${pstrStorageKey}`;
    }

    //*** Get Generic Data From Storage
    funcGetDataFromStorage(pstrStorageType, pstrStorageKey) {
        //*** Build Namespaced Key
        const strNamespacedKey = this.funcBuildNamespacedKey(pstrStorageKey);

        //*** Log Debug
        if (this.blnDebugMode) { console.log(`Data Manager - Retrieve ${pstrStorageType} Storage for key: ${strNamespacedKey}`); }

        //*** Attempt to Retrieve Storage
        let strStorageData = "";
        switch (pstrStorageType.toLowerCase()) {
            case "local":
                strStorageData = localStorage.getItem(strNamespacedKey);
                break;
            case "session":
                strStorageData = sessionStorage.getItem(strNamespacedKey);
                break;
            default:
                console.error("Data Manager - Storage Retrieval Type not supported: ", pstrStorageType)
        }

        //*** Return Data Found
        if (strStorageData) { if (this.blnDebugMode) { console.log(`Data Manager - ${pstrStorageType} Storage hit for key: ${strNamespacedKey}`); } }
        return strStorageData;
    }

    //*** Save Generic Data To Storage
    procSaveDataToStorage(pstrStorageType, pstrStorageKey, pstrData) {
        //*** Build Namespaced Key
        const strNamespacedKey = this.funcBuildNamespacedKey(pstrStorageKey);

        //*** Log Debug
        if (this.blnDebugMode) { console.log(`Data Manager - Save ${pstrStorageType} Storage for key: ${strNamespacedKey}`); }

        //*** Attempt to Save to Storage
        switch (pstrStorageType.toLowerCase()) {
            case "local":
                localStorage.setItem(strNamespacedKey, pstrData);
                break;
            case "session":
                sessionStorage.setItem(strNamespacedKey, pstrData);
                break;
            default:
                console.error("Data Manager - Storage Type not supported: ", pstrStorageType)
        }

        //*** Log Storage Saved
        if (this.blnDebugMode) { console.log(`Data Manager - ${pstrStorageType} Storage saved for key: ${strNamespacedKey}`); }
    }

    //*** Remove Single Item From Storage
    procRemoveDataFromStorage(pstrStorageType, pstrStorageKey) {
        //*** Build Namespaced Key
        const strNamespacedKey = this.funcBuildNamespacedKey(pstrStorageKey);

        //*** Log Debug
        if (this.blnDebugMode) { console.log(`Data Manager - Remove ${pstrStorageType} Storage for key: ${strNamespacedKey}`); }

        //*** Attempt to Remove from Storage
        switch (pstrStorageType.toLowerCase()) {
            case "local":
                localStorage.removeItem(strNamespacedKey);
                break;
            case "session":
                sessionStorage.removeItem(strNamespacedKey);
                break;
            default:
                console.error("Data Manager - Storage Type not supported: ", pstrStorageType)
        }
        //*** Log successful removal
        if (this.blnDebugMode) { console.log(`Data Manager - ${pstrStorageType} Storage removed for key: ${strNamespacedKey}`); }
    }

    //*** Clear All Session Storage for This Namespace
    procClearSessionStorage() {
        //*** Log Debug
        if (this.blnDebugMode) { console.log(`Data Manager - Clearing Session Storage for namespace: ${this.strStorageNamespace}`); }

        //*** Build Namespace Prefix
        const strNamespacePrefix = `${this.strStorageNamespace}::`;

        //*** Loop Through Session Storage and Remove Matching Keys
        let intKeysRemoved = 0;
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
            const strKey = sessionStorage.key(i);
            if (strKey && strKey.startsWith(strNamespacePrefix)) {
                sessionStorage.removeItem(strKey);
                intKeysRemoved++;
            }
        }

        //*** Log successful clear
        if (this.blnDebugMode) { console.log(`Data Manager - Session Storage cleared. Keys removed: ${intKeysRemoved}`); }
    }

    //*** Clear All Local Storage for This Namespace
    procClearLocalStorage() {
        //*** Log Debug
        if (this.blnDebugMode) { console.log(`Data Manager - Clearing Local Storage for namespace: ${this.strStorageNamespace}`); }

        //*** Build Namespace Prefix
        const strNamespacePrefix = `${this.strStorageNamespace}::`;

        //*** Loop Through Local Storage and Remove Matching Keys
        let intKeysRemoved = 0;
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const strKey = localStorage.key(i);
            if (strKey && strKey.startsWith(strNamespacePrefix)) {
                localStorage.removeItem(strKey);
                intKeysRemoved++;
            }
        }

        //*** Log successful clear
        if (this.blnDebugMode) { console.log(`Data Manager - Local Storage cleared. Keys removed: ${intKeysRemoved}`); }
    }

    // Save Data to Session Storage Cache
    procSaveJSONToStorage(pstrStorageType, pstrStorageKey, pjsonData) {
        try {
            //*** Convert JSON to string for storage
            const strJsonData = JSON.stringify(pjsonData);
            this.procSaveDataToStorage(pstrStorageType, pstrStorageKey, strJsonData);

            //*** Log cache save
            if (this.blnDebugMode) { console.log(`Data Manager - JSON Cached with key: ${pstrStorageKey}`); }

        } catch (error) {
            //*** Log cache save error but don't fail the operation
            console.error("Data Manager - Storage save error:", error.message);
        }
    }

    // Get Data from Session Storage Cache
    funcGetJSONFromStorage(pstrStorageType, pstrStorageKey) {
        try {
            //*** Retrieve JSON Data
            const strStoredData = this.funcGetDataFromStorage(pstrStorageType, pstrStorageKey);

            //*** Return null if no cached data found
            if (!strStoredData) { return null; }

            //*** Parse the JSON string back to object
            const jsonStoredData = JSON.parse(strStoredData);

            //*** Log cache hit
            if (this.blnDebugMode) { console.log(`Data Manager - ${pstrStorageType} Storage hit for key: ${pstrStorageKey}`); }

            //*** Return the parsed data
            return jsonStoredData;

        } catch (error) {
            //*** Log cache retrieval error and return null
            console.error(`Data Manager - Error retrieving ${pstrStorageType} Storage hit for key: ${pstrStorageKey}: `, error.message);
            return null;
        }
    }
}

/* Run Widget 
Main Hook to Replace Placeholder DIV tag
*/
(function () {
    //*** Wrap Initialize function 
    'use strict';
    function initNBAGameWidget() {
        //*** Get container and read data attributes
        const divWidgetContainer = document.getElementById("bbw-nbagamewidget-container");

        //*** Check if container exists
        if (!divWidgetContainer) {
            console.error("NBA Game Widget: Container element 'bbw-nbagamewidget-container' not found");
            return;
        }

        //***Extract Parameters
        const strGameDetailIDType = divWidgetContainer.dataset.gameDetailIdtype || "";
        const strGameDetailID = divWidgetContainer.dataset.gameDetailId || "";
        const strStorageNamespace = divWidgetContainer.dataset.storageNamespace || "bbw-nbawidget";
        const blnDebugMode = divWidgetContainer.dataset.debugMode === "true" || false;
        const strPrimaryTeam = divWidgetContainer.dataset.primaryTeam || "";

        //*** Initialize widget with parameters from HTML
        const objNBAGameWidget = new NBAGameWidget("bbw-nbagamewidget-container", strStorageNamespace, strGameDetailIDType, strGameDetailID, strPrimaryTeam, blnDebugMode);
        (async () => {
            //await objNBAGameWidget.procLoadGameData();
            objNBAGameWidget.procRenderWidgetContainer();
        })();
    }

    //*** Only run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initNBAGameWidget);
    } else {
        initNBAGameWidget();
    }
})();