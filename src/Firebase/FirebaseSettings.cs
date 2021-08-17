using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace TruthOrLie.Firebase
{
    public class FirebaseSettings
    {
        public string ApiKey { get; set; }
        public string AuthDomain { get; set; }
        public string DatabaseUrl { get; set; }
        public string ProjectId { get; set; }
        public string StorageBucket { get; set; }
        public string MessagingSenderId { get; set; }
        public string AppId { get; set; }
    }
}
